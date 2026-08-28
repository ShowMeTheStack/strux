// Hashing with open addressing: every key lives in the array itself, and a collision is solved by
// probing other slots. Linear, quadratic and double hashing, search, and delete with tombstones.
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  const OA = X.OAKit = {};
  const CW = 56, STEP = 66;
  const xOf = (i) => i * STEP;
  const EMPTY = -1, DELETED = -2;
  const plural = (n, w, ws) => n + ' ' + (n === 1 ? w : (ws || w + 's'));
  const show = (v) => (v === EMPTY || v === null || v === undefined ? '' : v === DELETED ? 'DEL' : v);
  const named = (v) => (v === EMPTY ? 'EMPTY' : v === DELETED ? 'DELETED' : String(v));

  X.family({
    id: 'oaddr', order: 2, group: 'Hashing', title: 'Open addressing',
    blurb: 'No lists at all: the keys sit in one array. When a key\'s home slot is taken, it probes other slots in a fixed order until it finds room.',
    head: (t, inp) => `#include <stdio.h>

#define M ${inp.m}
#define EMPTY   -1      /* never used: a search can stop here */
#define DELETED -2      /* a key was removed: a search must go on */

/* the table: each slot holds a key, EMPTY or DELETED */
int table[M];

/* the home slot of a key */
int hash(int key)
{
    return key % M;
}`,
  });

  // ---- probe sequences, in JavaScript too (to check inputs and to know the answers) -----------------------
  OA.probe = {
    linear: { c: '(hash(key) + i) % M', f: (k, i, m) => (k % m + i) % m },
    quadratic: { c: '(hash(key) + i * i) % M', f: (k, i, m) => (k % m + i * i) % m },
    double: { c: '(hash(key) + i * hash2(key)) % M', f: (k, i, m) => (k % m + i * (1 + k % (m - 1))) % m },
  };
  /** Put keys in a table the way main's put() will; returns {table, lost: [keys with no slot]} */
  OA.sim = function (keys, m, kind, gone) {
    const t = new Array(m).fill(EMPTY), lost = [];
    const f = OA.probe[kind].f;
    for (const k of keys) {
      let ok = false;
      for (let i = 0; i < m && !ok; i++) { const s = f(k, i, m); if (t[s] < 0) { t[s] = k; ok = true; } }
      if (!ok) lost.push(k);
    }
    for (const k of gone || []) {
      for (let i = 0; i < m; i++) { const s = f(k, i, m); if (t[s] === EMPTY) break; if (t[s] === k) { t[s] = DELETED; break; } }
    }
    return { table: t, lost };
  };

  /** C for main: helpers that fill the table quietly, then the calls the topic animates */
  OA.main = function (inp, kind, calls, gone) {
    const pc = OA.probe[kind].c;
    const keys = inp.keys || [];
    const erase = gone && gone.length ? `

void erase(int key)
{
    int i, slot;
    for (i = 0; i < M; i++) {
        slot = ${pc};
        if (table[slot] == EMPTY)
            return;
        if (table[slot] == key) {
            table[slot] = DELETED;
            return;
        }
    }
}` : '';
    return `/* main uses these to set up the table before the animation starts */
void put(int key)
{
    int i, slot;
    for (i = 0; i < M; i++) {
        slot = ${pc};
        if (table[slot] == EMPTY || table[slot] == DELETED) {
            table[slot] = key;
            return;
        }
    }
}${erase}

int main(void)
{
    int keys[] = { ${keys.length ? keys.join(', ') : '0'} };
    int i;
    for (i = 0; i < M; i++)
        table[i] = EMPTY;
    for (i = 0; i < ${keys.length}; i++)
        put(keys[i]);
${(gone || []).map((k) => '    erase(' + k + ');\n').join('')}${calls.map((c) => '    ' + c + '\n').join('')}    return 0;
}`;
  };

  OA.capture = function (P) {
    const M = P.ev('M');
    const fn = P.frames[0].name;
    const inside = fn !== 'main';
    const v = (n) => (inside && P.has(n, 0) && P.isSet(n, 0) ? P.val(n, 0) : null);
    return { M, t: P.arr('table', M), fn, calls: P.calls().map((c) => c.fn), h: v('h'), i: v('i'), slot: v('slot'), step: v('step'), key: v('key') };
  };

  /** The probe path of the call in progress: slots in the order they were probed */
  OA.track = function (ctx) {
    const m = ctx.memo, d = ctx.tick.data, tag = ctx.tick.tag;
    if (!m.path) { m.path = []; m.log = []; m.calls = 0; }
    // hash() and hash2() run quietly, and the picture of their line is taken as they return, before the
    // assignment: so the values are worked out here
    if (tag === 'hash') { m.path = []; m.calls++; m.key = d.key; m.h = d.key % d.M; m.result = undefined; m.step = null; }
    if (tag === 'hash2') m.step = 1 + d.key % (d.M - 1);
    if (tag === 'probe' && d.slot !== null) m.path.push(d.slot);
    return m.path;
  };

  /** Runs of slots in use (not EMPTY), going round the end: [{start, len}] */
  OA.runs = function (t) {
    const m = t.length;
    const e0 = t.findIndex((v) => v === EMPTY);
    if (e0 < 0) return [{ start: 0, len: m }];
    const out = [];
    let cur = null;
    for (let k = 1; k <= m; k++) {
      const i = (e0 + k) % m;
      if (t[i] !== EMPTY) { if (!cur) { cur = { start: i, len: 0 }; out.push(cur); } cur.len++; } else cur = null;
    }
    return out;
  };
  OA.runOf = (t, s) => OA.runs(t).find((r) => { const off = (s - r.start + t.length) % t.length; return off < r.len; }) || null;

  /**
   * The picture: formula box, key token, slots, probe arcs, runs.
   * o: {path, fan, hopLabel(k, a, b), home, cellCls(i, v), runs, token: slot | 'box' | null, key,
   *     verdict: {text, cls}, lines: [text], hotLine, seq, notes: [{slot, text, cls}]}
   */
  OA.draw = function (ctx, d, o) {
    const items = [];
    const M = d.M, t = d.t;
    const W = Math.max(xOf(M - 1) + CW, 420);
    // runs of filled slots, as bands under the table
    if (o.runs) {
      for (const r of OA.runs(t)) {
        if (r.len < 2) continue;
        const segs = r.start + r.len <= M ? [[r.start, r.start + r.len - 1]] : [[r.start, M - 1], [0, (r.start + r.len - 1) % M]];
        segs.forEach(([a, b], k) => items.push({ key: 'run' + r.start + (k ? 'w' : ''), kind: 'region', x: xOf(a) - 4, y: 120, w: xOf(b) - xOf(a) + CW + 8, h: 24, cls: 'oa-run', text: k ? '' : (r.len === M ? 'full' : 'run of ' + r.len) }));
      }
    }
    // the slots
    for (let i = 0; i < M; i++) {
      const v = t[i];
      items.push({ key: 'slot' + i, kind: 'cell', x: xOf(i), y: 0, w: CW, h: CW, text: show(v), sub: i, cls: (v === EMPTY ? 'empty' : v === DELETED ? 'oa-tomb' : '') + (o.cellCls ? ' ' + (o.cellCls(i, v) || '') : ''), pick: true, flash: o.flash === i });
    }
    // probe arcs: from one probe to the next, or (fan) from the home slot to every probe
    const path = o.path || [];
    for (let k = 1; k < path.length; k++) {
      const a = o.fan ? path[0] : path[k - 1], b = path[k];
      if (a === b) continue;
      // a cycle repeats a hop: draw only its latest copy
      let again = false;
      for (let j = k + 1; j < path.length; j++) if (path[j] === b && (o.fan || path[j - 1] === a)) again = true;
      if (again) continue;
      const dx = xOf(b) - xOf(a);
      const hgt = Math.min(30 + 0.2 * Math.abs(dx) + (o.fan ? 16 * k : 0), o.fan ? 150 : 100);
      const last = k === path.length - 1;
      items.push({ key: 'hop' + k, kind: 'arrow', from: { key: 'slot' + a, side: 'top' }, to: { key: 'slot' + b, side: 'top' }, bend: dx > 0 ? -hgt : hgt, cls: last ? 'hot' : 'part-b alt' });
      // fan arcs share a start, so their labels go under the slots they reach
      if (o.hopLabel) items.push({ key: 'hopl' + k, kind: 'text', x: o.fan ? xOf(b) + CW / 2 : (xOf(a) + xOf(b)) / 2 + CW / 2, y: o.fan ? 96 : -hgt / 2 - 6, text: o.hopLabel(k, a, b), cls: last ? 'oa-hop' : 'oa-hop-old', anchor: 'middle' });
    }
    if (o.home !== null && o.home !== undefined) items.push({ key: 'home', kind: 'cursor', at: 'slot' + o.home, side: 'below', text: 'home', cls: 'c-indigo' });
    // the formula box
    const lines = o.lines || [];
    const bh = 34 + 25 * Math.max(1, lines.length);
    const by = -140 - bh;
    items.push({ key: 'hbox', kind: 'region', x: 0, y: by, w: 400, h: bh, cls: 'box', text: o.boxTitle || 'probing' });
    lines.forEach((l, k) => items.push({ key: 'hb' + k, kind: 'text', x: 16, y: by + 44 + 25 * k, text: l, cls: 'oa-formula' + (k === o.hotLine ? ' hot' : '') }));
    // the key, hopping from slot to slot
    if (o.token !== null && o.token !== undefined && o.key !== null && o.key !== undefined) {
      const tx = o.token === 'box' ? 430 : xOf(o.token) + CW / 2;
      const ty = o.token === 'box' ? by + bh / 2 : -96;
      items.push({ key: 'tok', kind: 'token', x: tx, y: ty, r: 18, text: String(o.key), cls: 'oa-key', arc: 50 });
      if (o.verdict && o.verdict.text) {
        const right = tx + 26 + o.verdict.text.length * 7.5 < W + 80;
        items.push({ key: 'verdict', kind: 'text', x: right ? tx + 26 : tx - 26, y: ty + 5, text: o.verdict.text, cls: 'oa-verdict ' + (o.verdict.cls || ''), anchor: right ? 'start' : 'end' });
      }
    }
    for (const n of o.notes || []) items.push({ key: 'note' + n.slot, kind: 'text', x: xOf(n.slot) + CW / 2, y: n.y || 170, text: n.text, cls: n.cls || 'note', anchor: 'middle' });
    if (o.seq) items.push({ key: 'seq', kind: 'text', x: 0, y: o.runs ? 178 : 150, text: o.seq, cls: 'oa-seq' });
    return items;
  };

  /** "probes: 2 → 3 → 4" */
  OA.seqText = (path, extra) => (path.length ? 'probe sequence: ' + path.join(' → ') + (extra || '') : '');

  // ---- shared inputs ---------------------------------------------------------------------------------------
  const keyList = (v) => (v.some((x) => x < 0) ? 'Keys: 0 or more (negative numbers are used for EMPTY and DELETED)' : null);
  const mIn = (def) => ({ id: 'm', kind: 'int', label: 'Slots (M)', def, lo: 3, hi: 13 });
  const preIn = (def) => ({ id: 'keys', kind: 'ints', label: 'Keys already in the table', def, min: 0, max: 13, distinct: true, check: keyList });
  const insIn = (def) => ({ id: 'ins', kind: 'ints', label: 'Insert, in this order', def, min: 1, max: 6, distinct: true, check: keyList });
  const insertCheck = (kind) => (inp) => {
    if (inp.keys.length > inp.m) return 'At most ' + inp.m + ' keys fit in ' + inp.m + ' slots';
    const both = inp.ins.find((k) => inp.keys.includes(k));
    if (both !== undefined) return both + ' is already in the table';
    const s = OA.sim(inp.keys, inp.m, kind);
    if (s.lost.length) return 'With M = ' + inp.m + ', ' + s.lost[0] + ' finds no free slot while the table is being set up: give fewer keys';
    return null;
  };

  /** Common narration for the probe loop of an insert. f: {formula(i) -> text of the slot computation} */
  function insertSay(ctx, d, tag, memo, path, f) {
    const key = memo.key, h = memo.h, M = d.M;
    const cur = path[path.length - 1];
    switch (tag) {
      case 'loop': return d.i === null ? '' : d.i >= M ? 'i has reached ' + M + ': every probe has been tried.' : d.i === 0 ? 'i = 0: the first probe is the home slot itself.' : f.loop(d.i);
      case 'probe': return 'slot = ' + f.formula(d.i) + '.' + (f.wraps(d.i) ? ' That went past the end, so % ' + M + ' wraps it round to the start.' : '');
      case 'test': return d.t[cur] === EMPTY ? 'Slot ' + cur + ' is EMPTY: free.' : d.t[cur] === DELETED ? 'Slot ' + cur + ' is DELETED: a removed key\'s place, free to reuse.' : 'Slot ' + cur + ' holds ' + d.t[cur] + ': taken, a collision. Probe again.';
      case 'place': return 'table[' + cur + '] = ' + key + '. It took ' + plural(path.length, 'probe') + (path.length > 1 ? ' (' + path.join(', ') + ').' : ': its home was free.');
      case 'done': return 'insert(' + key + ') returns ' + cur + '.';
      case 'full': return 'No free slot was found in ' + plural(M, 'probe') + '. insert(' + key + ') returns -1 and ' + key + ' is not stored.';
    }
    return '';
  }

  // ---- linear probing: insert ------------------------------------------------------------------------------
  X.topic({
    id: 'oa-linear-insert', family: 'oaddr', order: 10, title: 'Linear probing: insert',
    blurb: 'If the home slot is taken, try the next one, and the next, wrapping round at the end. Simple, but filled slots clump into runs that keep growing.',
    code: `/* put key in the first free slot from its home on;
   returns the slot, or -1 if the table is full */
int insert(int key)
{
    int h = hash(key);                                          /*@ hash */
    int i, slot;
    for (i = 0; i < M; i++) {                                   /*@ loop */
        slot = (h + i) % M;                                     /*@ probe */
        if (table[slot] == EMPTY || table[slot] == DELETED) {   /*@ test */
            table[slot] = key;                                  /*@ place */
            return slot;                                        /*@ done */
        }
    }
    return -1;                                                  /*@ full */
}`,
    animate: ['insert'], quiet: ['hash'],
    inputs: [preIn([22, 13, 35]), mIn(11), insIn([46, 5, 16, 27])],
    check: insertCheck('linear'),
    presets: [
      { label: 'A run grows', values: { keys: [22, 13, 35], m: 11, ins: [46, 5, 16, 27] } },
      { label: 'Wrap round the end', values: { keys: [5, 6], m: 7, ins: [12, 19] } },
      { label: 'No collisions', values: { keys: [], m: 11, ins: [3, 16, 29, 42] } },
      { label: 'A full table', values: { keys: [1, 2, 3, 4, 5], m: 5, ins: [7] } },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => OA.main(inp, 'linear', inp.ins.map((k) => 'insert(' + k + ');')),
    capture: OA.capture,
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, memo = ctx.memo, M = d.M;
      const path = OA.track(ctx);
      memo.probes = memo.probes || [];
      if (tag === 'place' || tag === 'full') memo.probes.push(path.length);
      if (tag === 'place') memo.result = path[path.length - 1];
      if (tag === 'full') memo.result = -1;
      const cur = path.length ? path[path.length - 1] : null;
      const key = memo.key, h = memo.h;
      const live = tag !== 'after' && tag !== 'enter';
      let verdict = null;
      if (tag === 'test' || tag === 'place' || tag === 'done') verdict = d.t[cur] === key ? { text: 'stored in slot ' + cur, cls: 'good' } : d.t[cur] < 0 ? { text: named(d.t[cur]) + ': free', cls: 'good' } : { text: 'taken by ' + d.t[cur], cls: 'bad' };
      if (tag === 'full') verdict = { text: 'no room', cls: 'bad' };
      const lines = [];
      if (key !== undefined && key !== null) lines.push('h = hash(' + key + ') = ' + key + ' % ' + M + ' = ' + h);
      if (live && d.i !== null && cur !== null && path.length) lines.push('probe ' + (path.length - 1) + ': (' + h + ' + ' + (path.length - 1) + ') % ' + M + ' = ' + cur);
      const items = OA.draw(ctx, d, {
        path: live || tag === 'after' ? path : [], home: key !== undefined && tag !== 'enter' ? h : null, runs: true,
        hopLabel: (k, a, b) => (b < a ? '+1, wrap' : '+1'),
        cellCls: (i) => (memo.result === i && (tag === 'place' || tag === 'done' || tag === 'after') ? 'part-a' : live && i === cur ? 'focus' : path.includes(i) && tag !== 'enter' ? 'oa-seen' : ''),
        flash: tag === 'place' ? cur : null,
        token: tag === 'enter' ? null : tag === 'hash' ? 'box' : cur, key, verdict,
        lines, hotLine: lines.length - 1, boxTitle: 'linear probing: h, h+1, h+2, ...',
        seq: tag !== 'enter' ? OA.seqText(path) : '',
      });
      const f = {
        loop: (i) => 'i = ' + i + ': the slot before was taken, so step one further on.',
        formula: (i) => '(' + h + ' + ' + i + ') % ' + M + ' = ' + ((h + i) % M),
        wraps: (i) => h + i >= M,
      };
      let say = insertSay(ctx, d, tag, memo, path, f);
      switch (tag) {
        case 'enter': say = 'Insert ' + inp.ins.join(', ') + ' into a table of ' + M + ' slots, one after the other. Linear probing: if a key\'s home slot is taken, try the next slot along.'; break;
        case 'hash': say = 'insert(' + key + '): hash(' + key + ') = ' + key + ' % ' + M + ' = ' + h + '. Slot ' + h + ' is its home.'; break;
        case 'place': {
          const r = OA.runOf(d.t, cur);
          if (r && r.len > 1) say += ' Slots ' + r.start + ' to ' + (r.start + r.len - 1) % M + ' are now one run of ' + r.len + ' filled slots. Any key whose home lands in it slides to its end and makes it longer: primary clustering.';
          break;
        }
        case 'after': {
          const longest = Math.max(0, ...OA.runs(d.t).map((r) => r.len));
          say = memo.calls < inp.ins.length ? 'Next key.' : 'All done. Probes per insert: ' + memo.probes.join(', ') + '. The longest run of filled slots is ' + longest + ' long; a key that hashes into it pays for the whole run.';
          if (memo.calls < inp.ins.length) say = key + ' is in slot ' + memo.result + '. Next key.';
          if (memo.calls < inp.ins.length && memo.result === -1) say = key + ' could not be stored. Next key.';
          break;
        }
      }
      return { items, say, slow: tag === 'place' };
    },
    predict: [
      { at: (t) => t.tag === 'hash', once: true, ask: (t) => 'Where will ' + t.data.key + ' end up? Click its slot.', answer: (ts, i) => { for (let j = i + 1; j < ts.length; j++) { if (ts[j].tag === 'place') return 'slot' + ts[j].data.slot; if (ts[j].tag === 'full') return null; } return null; }, explain: (ts, i) => 'Start at its home, slot ' + ts[i].data.h + ', and step right until a slot is free.' },
      { at: (t, i, ts) => t.tag === 'hash' && ts.slice(0, i).some((x) => x.tag === 'hash') && !ts.slice(i + 1).some((x) => x.tag === 'hash'), once: true, ask: (t) => 'How many probes will ' + t.data.key + ' need?', options: () => ['1', '2', '3', '4', '5', '6', '7'], answer: (ts, i) => { let n = 0; for (let j = i + 1; j < ts.length && ts[j].tag !== 'hash'; j++) if (ts[j].tag === 'probe') n++; return n <= 7 ? String(n) : null; }, pick: 'option', explain: () => 'Count from its home to the end of the run it lands in, plus one for the free slot.' },
    ],
    quiz: [
      { q: 'With M = 11, 13 is in slot 2 and 35 in slot 3. Where does 46 (home 2) go if slot 4 is free?', options: ['Slot 2', 'Slot 3', 'Slot 4', 'Slot 5'], answer: 2, why: 'Probe 2 (taken), 3 (taken), 4 (free).' },
      { q: 'What is primary clustering?', options: ['Keys with the same home share one list', 'Filled slots join into long runs, and any key landing in a run makes it longer', 'The table is sorted', 'Two hash functions agree'], answer: 1, why: 'A key that hashes anywhere into a run walks to its end and fills the next slot, so big runs grow fastest.' },
      { q: 'Why does the probe use % M?', options: ['To sort the keys', 'So that probing past the last slot wraps round to slot 0', 'To make keys smaller', 'It is not needed'], answer: 1, why: 'h + i can pass M - 1; % M brings it back to the start of the array.' },
      { q: 'When can insert return -1 with linear probing?', options: ['When there is a collision', 'Only when every slot is filled', 'When the home slot is DELETED', 'Never'], answer: 1, why: 'Linear probing visits every slot within M probes, so it fails only on a full table.' },
      { q: 'Why do open addressing tables keep the load factor well below 1?', options: ['To save memory', 'As the table fills, runs grow and the number of probes rises steeply', 'Because hash() fails', 'They do not'], answer: 1, why: 'Near full, almost every key lands in a long run; inserts and failed searches get slow.' },
    ],
    compareWith: 'oa-quadratic',
  });

  // ---- linear probing: search ------------------------------------------------------------------------------
  const SEARCH = `/* the slot holding key, or -1 if it is not in the table */
int search(int key)
{
    int h = hash(key);                /*@ hash */
    int i, slot;
    for (i = 0; i < M; i++) {         /*@ loop */
        slot = (h + i) % M;           /*@ probe */
        if (table[slot] == EMPTY)     /*@ empty-test */
            return -1;                /*@ missing */
        if (table[slot] == key)       /*@ match */
            return slot;              /*@ found */
    }
    return -1;                        /*@ full */
}`;
  /** Verdict and narration for one step of search() */
  function searchStep(d, tag, memo, path) {
    const key = memo.key, h = memo.h, M = d.M;
    const cur = path.length ? path[path.length - 1] : null;
    const v = cur === null ? null : d.t[cur];
    let verdict = null, say = '';
    switch (tag) {
      case 'hash': say = 'search(' + key + '): hash(' + key + ') = ' + key + ' % ' + M + ' = ' + h + '. If ' + key + ' is in the table, it is in slot ' + h + ' or somewhere after it, before the next EMPTY slot.'; break;
      case 'loop': say = d.i === null ? '' : d.i >= M ? 'i has reached ' + M + ': every slot has been probed.' : d.i === 0 ? 'i = 0: look at the home slot first.' : 'i = ' + d.i + ': on to the next slot.'; break;
      case 'probe': say = 'slot = (' + h + ' + ' + d.i + ') % ' + M + ' = ' + cur + '.' + (h + d.i >= M ? ' Past the end, so it wraps round.' : ''); break;
      case 'empty-test': verdict = v === EMPTY ? { text: 'EMPTY: stop', cls: 'bad' } : { text: v === DELETED ? 'DELETED, not EMPTY' : 'not EMPTY', cls: v === DELETED ? 'warn' : '' }; say = v === EMPTY ? 'Slot ' + cur + ' is EMPTY. Had ' + key + ' been inserted, it would have taken this slot or one before it, so it is not in the table.' : 'Slot ' + cur + ' is not EMPTY (' + named(v) + '), so the search cannot stop yet.'; break;
      case 'missing': verdict = { text: 'not found', cls: 'bad' }; say = 'search returns -1 after ' + plural(path.length, 'probe') + '.'; break;
      case 'match': verdict = v === key ? { text: '✓ ' + key + ' = ' + key, cls: 'good' } : v === DELETED ? { text: 'DELETED: keep going', cls: 'warn' } : { text: '✗ ' + v + ' ≠ ' + key, cls: 'bad' }; say = v === key ? 'table[' + cur + '] is ' + key + ': found.' : v === DELETED ? 'Slot ' + cur + ' is a tombstone: a key was deleted here. ' + key + ' may have been placed after it, so the search goes past it.' : v + ' is not ' + key + ': it only got here by probing too. Try the next slot.'; break;
      case 'found': verdict = { text: '✓ found in slot ' + cur, cls: 'good' }; say = 'search returns ' + cur + ' after ' + plural(path.length, 'probe') + '.'; break;
      case 'full': verdict = { text: 'not found', cls: 'bad' }; say = 'Every slot was probed and there is no EMPTY one to stop at: ' + key + ' is not in the table. search returns -1.'; break;
    }
    return { verdict, say, cur };
  }

  X.topic({
    id: 'oa-linear-search', family: 'oaddr', order: 20, title: 'Linear probing: search',
    blurb: 'Probe from the home slot exactly as insert did. An EMPTY slot ends the search; a DELETED one does not.',
    code: SEARCH,
    animate: ['search'], quiet: ['hash'],
    inputs: [
      preIn([22, 13, 35, 46, 5, 16]), mIn(11),
      { id: 'gone', kind: 'ints', label: 'Deleted earlier (tombstones)', def: [35], min: 0, max: 4, distinct: true },
      { id: 'key', kind: 'int', label: 'Search for', def: 46, lo: 0, hi: 999 },
    ],
    check: (inp) => {
      if (inp.keys.length > inp.m) return 'At most ' + inp.m + ' keys fit in ' + inp.m + ' slots';
      const g = inp.gone.find((k) => !inp.keys.includes(k));
      if (g !== undefined) return 'Deleted earlier: ' + g + ' is not one of the keys';
      return null;
    },
    presets: [
      { label: 'Past a tombstone', values: { keys: [22, 13, 35, 46, 5, 16], m: 11, gone: [35], key: 46 } },
      { label: 'Found after a run', values: { keys: [22, 13, 35, 46, 5, 16], m: 11, gone: [], key: 16 } },
      { label: 'Not there', values: { keys: [22, 13, 35, 46, 5, 16], m: 11, gone: [], key: 24 } },
      { label: 'Wrap round the end', values: { keys: [5, 12, 19, 3], m: 7, gone: [], key: 19 } },
      { label: 'Deleted key', values: { keys: [22, 13, 35, 46, 5, 16], m: 11, gone: [35], key: 35 } },
    ],
    counters: ['compares'],
    main: (inp) => OA.main(inp, 'linear', ['search(' + inp.key + ');'], inp.gone),
    capture: OA.capture,
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, memo = ctx.memo, M = d.M;
      const path = OA.track(ctx);
      if (tag === 'enter') { memo.key = inp.key; memo.h = inp.key % M; }
      const st = searchStep(d, tag, memo, path);
      const cur = st.cur, key = memo.key, h = memo.h;
      if (tag === 'found') memo.result = cur;
      const lines = ['h = hash(' + key + ') = ' + key + ' % ' + M + ' = ' + h];
      if (path.length) lines.push('probe ' + (path.length - 1) + ': (' + h + ' + ' + (path.length - 1) + ') % ' + M + ' = ' + cur);
      const items = OA.draw(ctx, d, {
        path, home: tag === 'enter' ? null : h, runs: true, hopLabel: (k, a, b) => (b < a ? '+1, wrap' : '+1'),
        cellCls: (i, v) => (memo.result === i ? 'part-a' : i === cur && tag !== 'after' ? (v === DELETED ? 'focus' : v === EMPTY && tag !== 'probe' ? 'bad' : 'focus') : path.includes(i) ? 'oa-seen' : ''),
        token: tag === 'enter' ? 'box' : tag === 'hash' ? 'box' : cur, key, verdict: st.verdict,
        lines, hotLine: lines.length - 1, boxTitle: 'linear probing search',
        seq: OA.seqText(path),
      });
      let say = st.say;
      if (tag === 'enter') say = 'search(' + key + ') in a table of ' + M + ' slots' + (inp.gone.length ? ', where ' + inp.gone.join(' and ') + (inp.gone.length === 1 ? ' was' : ' were') + ' deleted earlier and left tombstones (DEL)' : '') + '. It must follow the same probe sequence insert used.';
      if (tag === 'after') say = memo.result !== undefined ? key + ' was found in slot ' + memo.result + ' after ' + plural(path.length, 'probe') + '.' : key + ' is not in the table; finding that out took ' + plural(path.length, 'probe') + '. A failed search walks the whole run, so long runs make it slow.';
      return { items, say, slow: tag === 'found' || tag === 'missing' };
    },
    predict: [
      { at: (t) => t.tag === 'hash', once: true, ask: 'In which slot will the search stop? Click it.', answer: (ts) => { const p = ts.filter((t) => t.tag === 'probe'); return p.length ? 'slot' + p[p.length - 1].data.slot : null; }, explain: () => 'It stops at the key, or at the first EMPTY slot of its probe sequence.' },
      { at: (t, i, ts) => t.tag === 'probe' && ts[i + 1] && ts[i + 1].tag === 'empty-test' && t.data.t[t.data.slot] === DELETED, once: true, ask: 'This slot is DELETED. Does the search stop here?', options: () => ['Yes: report not found', 'No: keep probing'], answer: () => 'No: keep probing', pick: 'option', explain: () => 'A key that collided with the deleted one may sit further along; stopping here would miss it.' },
    ],
    quiz: [
      { q: 'Why can the search stop at an EMPTY slot?', options: ['EMPTY slots are rare', 'insert would have put the key there or earlier, so it cannot be further on', 'It is faster', 'It cannot'], answer: 1, why: 'insert takes the first free slot of the sequence. An EMPTY slot means the key never reached past it.' },
      { q: 'Why must the search not stop at a DELETED slot?', options: ['It must', 'The slot was filled when later keys were inserted, so they may lie beyond it', 'DELETED means found', 'To count tombstones'], answer: 1, why: 'Keys inserted while the slot was full probed past it. The tombstone keeps that path open.' },
      { q: 'Which costs more probes on average with a crowded table?', options: ['A search that finds the key', 'A search for a missing key', 'They are always equal', 'Neither probes'], answer: 1, why: 'A missing key is only confirmed at an EMPTY slot, so it walks to the end of the run.' },
      { q: 'A search with every slot filled or DELETED and the key absent takes...', options: ['1 probe', 'M probes', 'log M probes', 'It never ends'], answer: 1, why: 'There is no EMPTY slot to stop at, so the loop runs all M times.' },
    ],
  });

  // ---- quadratic probing -----------------------------------------------------------------------------------
  X.topic({
    id: 'oa-quadratic', family: 'oaddr', order: 30, title: 'Quadratic probing',
    blurb: 'Jump 1, 4, 9, 16 ... slots from home. Runs no longer swallow their neighbours, but keys with the same home still follow the same path.',
    code: `/* probe h, h+1, h+4, h+9 ... for a free slot;
   returns the slot, or -1 if none was found */
int insert(int key)
{
    int h = hash(key);                                          /*@ hash */
    int i, slot;
    for (i = 0; i < M; i++) {                                   /*@ loop */
        slot = (h + i * i) % M;                                 /*@ probe */
        if (table[slot] == EMPTY || table[slot] == DELETED) {   /*@ test */
            table[slot] = key;                                  /*@ place */
            return slot;                                        /*@ done */
        }
    }
    return -1;                                                  /*@ full */
}`,
    animate: ['insert'], quiet: ['hash'],
    inputs: [preIn([22, 13, 35]), mIn(11), insIn([46, 24, 5])],
    check: insertCheck('quadratic'),
    presets: [
      { label: 'Same home, same path', values: { keys: [22, 13, 35], m: 11, ins: [46, 24, 5] } },
      { label: 'Keys from linear probing', values: { keys: [22, 13, 35], m: 11, ins: [46, 5, 16, 27] } },
      { label: 'Jumps that wrap', values: { keys: [8, 20, 9], m: 11, ins: [31, 42] } },
      { label: 'M = 8 (not prime)', values: { keys: [0, 1, 4], m: 8, ins: [8] } },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => OA.main(inp, 'quadratic', inp.ins.map((k) => 'insert(' + k + ');')),
    capture: OA.capture,
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, memo = ctx.memo, M = d.M;
      const path = OA.track(ctx);
      if (!memo.homes) { memo.homes = new Map(); for (const k of inp.keys) { const hh = k % M; memo.homes.set(hh, (memo.homes.get(hh) || []).concat(k)); } }
      memo.probes = memo.probes || [];
      if (tag === 'place' || tag === 'full') { memo.probes.push(path.length); memo.homes.set(memo.h, (memo.homes.get(memo.h) || []).concat(memo.key)); }
      if (tag === 'hash') memo.result = undefined;
      if (tag === 'place') memo.result = path[path.length - 1];
      if (tag === 'full') memo.result = -1;
      const cur = path.length ? path[path.length - 1] : null;
      const key = memo.key, h = memo.h;
      const live = tag !== 'after' && tag !== 'enter';
      let verdict = null;
      if (tag === 'test' || tag === 'place' || tag === 'done') verdict = d.t[cur] === key ? { text: 'stored in slot ' + cur, cls: 'good' } : d.t[cur] < 0 ? { text: named(d.t[cur]) + ': free', cls: 'good' } : { text: 'taken by ' + d.t[cur], cls: 'bad' };
      if (tag === 'full') verdict = { text: 'no room found', cls: 'bad' };
      const lines = [];
      if (key !== undefined && key !== null) lines.push('h = hash(' + key + ') = ' + key + ' % ' + M + ' = ' + h);
      const ii = path.length - 1;
      if (live && path.length) lines.push('probe ' + ii + ': (' + h + ' + ' + ii + '×' + ii + ') % ' + M + ' = ' + (h + ii * ii) + ' % ' + M + ' = ' + cur);
      const items = OA.draw(ctx, d, {
        path: tag === 'enter' ? [] : path, fan: true, home: key !== undefined && tag !== 'enter' ? h : null,
        hopLabel: (k) => '+' + k * k,
        cellCls: (i) => (memo.result === i && (tag === 'place' || tag === 'done' || tag === 'after') ? 'part-a' : live && i === cur ? 'focus' : path.includes(i) && tag !== 'enter' ? 'oa-seen' : ''),
        flash: tag === 'place' ? cur : null,
        token: tag === 'enter' ? null : tag === 'hash' ? 'box' : cur, key, verdict,
        lines, hotLine: lines.length - 1, boxTitle: 'quadratic probing: h, h+1, h+4, h+9, ...',
        seq: tag !== 'enter' ? OA.seqText(path) : '',
      });
      const f = {
        loop: (i) => 'i = ' + i + ': jump i² = ' + i * i + ' slots from home (not from the last probe).',
        formula: (i) => '(' + h + ' + ' + i + '×' + i + ') % ' + M + ' = ' + (h + i * i) + ' % ' + M + ' = ' + ((h + i * i) % M),
        wraps: (i) => h + i * i >= M,
      };
      let say = insertSay(ctx, d, tag, memo, path, f);
      switch (tag) {
        case 'enter': say = 'Insert ' + inp.ins.join(', ') + ' with quadratic probing: the i-th probe is i² slots from home, so the jumps grow: 1, 4, 9, 16 ...'; break;
        case 'hash': {
          const same = (memo.homes.get(h) || []).filter((k) => k !== key);
          say = 'insert(' + key + '): home slot ' + key + ' % ' + M + ' = ' + h + '.' + (same.length ? ' ' + same.join(' and ') + (same.length === 1 ? ' has' : ' have') + ' the same home, so ' + key + ' will follow exactly the same probe sequence: secondary clustering.' : '');
          break;
        }
        case 'full': {
          const empties = d.t.filter((v) => v === EMPTY).length;
          const seen = [...new Set(path)].sort((a, b) => a - b);
          say = M + ' probes, and only slots ' + seen.join(', ') + ' were ever reached, though ' + plural(empties, 'slot is', 'slots are') + ' EMPTY. ' + (empties ? 'With M = ' + M + ', i² % M takes only a few values. Quadratic probing needs M prime and the table under half full to be sure of a slot.' : 'The table is full.');
          break;
        }
        case 'after': say = memo.calls < inp.ins.length ? (memo.result === -1 ? key + ' could not be stored.' : key + ' is in slot ' + memo.result + '.') + ' Next key.' : (memo.result === -1 ? key + ' could not be stored, though the table has room: the probes only ever reached ' + [...new Set(path)].length + ' slots.' : 'All done. Probes per insert: ' + memo.probes.join(', ') + '. Jumps that grow scatter a crowded area instead of making one long run.'); break;
      }
      return { items, say, slow: tag === 'place' };
    },
    predict: [
      { at: (t) => t.tag === 'loop' && t.data.i === 2, once: true, ask: (t, ts, i, ctx) => 'i = 2. Which slot is probed now? Click it.', answer: (ts, i) => 'slot' + (ts[i].data.h + 4) % ts[i].data.M, explain: (ts, i) => '(h + 2×2) % M = (' + ts[i].data.h + ' + 4) % ' + ts[i].data.M + ' = ' + (ts[i].data.h + 4) % ts[i].data.M + '.' },
      { at: (t, i, ts) => t.tag === 'hash' && ts.slice(0, i).some((x) => x.tag === 'hash'), once: true, ask: (t) => 'How many probes will ' + t.data.key + ' need?', options: () => ['1', '2', '3', '4', '5', '6', '7', '8'], answer: (ts, i) => { let n = 0; for (let j = i + 1; j < ts.length && ts[j].tag !== 'hash'; j++) if (ts[j].tag === 'probe') n++; return n <= 8 ? String(n) : null; }, pick: 'option', explain: () => 'Follow h, h+1, h+4, h+9 ... (mod M) until a slot is free.' },
      { at: (t) => t.tag === 'hash', once: true, ask: (t) => 'Where will ' + t.data.key + ' end up? Click its slot.', answer: (ts, i) => { for (let j = i + 1; j < ts.length; j++) { if (ts[j].tag === 'place') return 'slot' + ts[j].data.slot; if (ts[j].tag === 'full') return null; } return null; }, explain: (ts, i) => 'Try h, h+1, h+4, h+9 ... from home slot ' + ts[i].data.h + '.' },
    ],
    quiz: [
      { q: 'With home slot 2 and M = 11, what are the first four probes?', options: ['2, 3, 4, 5', '2, 3, 6, 0', '2, 4, 8, 16', '2, 3, 5, 8'], answer: 1, why: '2 + 0, 2 + 1, 2 + 4, and 2 + 9 = 11, which wraps to 0.' },
      { q: 'What problem of linear probing does quadratic probing reduce?', options: ['Secondary clustering', 'Primary clustering: neighbouring runs merging into long ones', 'Deleting keys', 'Hashing negative keys'], answer: 1, why: 'Keys from nearby homes spread out with growing jumps instead of all queuing at the end of one run.' },
      { q: 'What is secondary clustering?', options: ['Keys with the same home follow exactly the same probe sequence', 'Runs merge', 'Two tables share keys', 'Tombstones pile up'], answer: 0, why: 'The sequence depends only on h, so every key with that home retraces the same path.' },
      { q: 'Why can quadratic probing fail on a table that is not full?', options: ['It cannot', 'i² % M may only reach some of the slots', 'It skips slot 0', 'Because of DELETED'], answer: 1, why: 'With M = 8, i² % 8 is only 0, 1 or 4. With M prime and the table under half full a free slot is always reached.' },
    ],
    compareWith: 'oa-linear-insert',
  });

  // ---- double hashing --------------------------------------------------------------------------------------
  X.topic({
    id: 'oa-double', family: 'oaddr', order: 40, title: 'Double hashing',
    blurb: 'A second hash function picks the step size. Keys with the same home usually take different steps, so they go their separate ways.',
    code: `/* the step between probes: 1 to M - 1, never 0 */
int hash2(int key)
{
    return 1 + key % (M - 1);
}

/* probe h, h+step, h+2*step ... for a free slot */
int insert(int key)
{
    int h = hash(key);                                          /*@ hash */
    int step = hash2(key);                                      /*@ hash2 */
    int i, slot;
    for (i = 0; i < M; i++) {                                   /*@ loop */
        slot = (h + i * step) % M;                              /*@ probe */
        if (table[slot] == EMPTY || table[slot] == DELETED) {   /*@ test */
            table[slot] = key;                                  /*@ place */
            return slot;                                        /*@ done */
        }
    }
    return -1;                                                  /*@ full */
}`,
    animate: ['insert'], quiet: ['hash', 'hash2'],
    inputs: [preIn([22, 13, 35, 7, 18]), mIn(11), insIn([46, 24, 57])],
    check: insertCheck('double'),
    presets: [
      { label: 'Same home, different paths', values: { keys: [22, 13, 35, 7, 18], m: 11, ins: [46, 24, 57] } },
      { label: 'A long walk', values: { keys: [1, 2, 4, 6, 8, 10, 3], m: 11, ins: [12] } },
      { label: 'No collisions', values: { keys: [], m: 11, ins: [3, 16, 29] } },
      { label: 'M = 10 (not prime)', values: { keys: [3, 8], m: 10, ins: [13] } },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => OA.main(inp, 'double', inp.ins.map((k) => 'insert(' + k + ');')),
    capture: OA.capture,
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, memo = ctx.memo, M = d.M;
      const path = OA.track(ctx);
      memo.probes = memo.probes || [];
      memo.steps = memo.steps || [];
      if (tag === 'hash2') memo.steps.push({ key: memo.key, h: memo.h, step: memo.step });
      if (tag === 'hash') memo.result = undefined;
      if (tag === 'place' || tag === 'full') memo.probes.push(path.length);
      if (tag === 'place') memo.result = path[path.length - 1];
      if (tag === 'full') memo.result = -1;
      const cur = path.length ? path[path.length - 1] : null;
      const key = memo.key, h = memo.h, step = memo.step;
      const live = tag !== 'after' && tag !== 'enter';
      let verdict = null;
      if (tag === 'test' || tag === 'place' || tag === 'done') verdict = d.t[cur] === key ? { text: 'stored in slot ' + cur, cls: 'good' } : d.t[cur] < 0 ? { text: named(d.t[cur]) + ': free', cls: 'good' } : { text: 'taken by ' + d.t[cur], cls: 'bad' };
      if (tag === 'full') verdict = { text: 'no room found', cls: 'bad' };
      const lines = [];
      if (key !== undefined && key !== null) lines.push('h    = ' + key + ' % ' + M + ' = ' + h);
      if (key !== undefined && key !== null && step !== null) lines.push('step = 1 + ' + key + ' % ' + (M - 1) + ' = ' + step);
      const ii = path.length - 1;
      if (live && path.length) lines.push('probe ' + ii + ': (' + h + ' + ' + ii + '×' + step + ') % ' + M + ' = ' + cur);
      const items = OA.draw(ctx, d, {
        path: tag === 'enter' ? [] : path, home: key !== undefined && tag !== 'enter' ? h : null,
        hopLabel: () => '+' + step,
        cellCls: (i) => (memo.result === i && (tag === 'place' || tag === 'done' || tag === 'after') ? 'part-a' : live && i === cur ? 'focus' : path.includes(i) && tag !== 'enter' ? 'oa-seen' : ''),
        flash: tag === 'place' ? cur : null,
        token: tag === 'enter' ? null : tag === 'hash' || tag === 'hash2' ? 'box' : cur, key, verdict,
        lines, hotLine: tag === 'hash' ? 0 : tag === 'hash2' ? 1 : lines.length - 1, boxTitle: 'double hashing: two hash functions',
        seq: tag !== 'enter' ? OA.seqText(path) : '',
      });
      const f = {
        loop: (i) => 'i = ' + i + ': move another ' + step + ' slots on.',
        formula: (i) => '(' + h + ' + ' + i + '×' + step + ') % ' + M + ' = ' + (h + i * step) + ' % ' + M + ' = ' + ((h + i * step) % M),
        wraps: (i) => h + i * step >= M,
      };
      let say = insertSay(ctx, d, tag, memo, path, f);
      switch (tag) {
        case 'enter': say = 'Insert ' + inp.ins.join(', ') + ' with double hashing: hash() gives the home slot, hash2() gives the step between probes.'; break;
        case 'hash': say = 'insert(' + key + '): first hash, the home slot: ' + key + ' % ' + M + ' = ' + h + '.'; break;
        case 'hash2': {
          const twin = memo.steps.find((s) => s.h === h && s.key !== key);
          say = 'Second hash, the step: 1 + ' + key + ' % ' + (M - 1) + ' = ' + step + '. The 1 + makes sure the step is never 0.' + (twin ? ' ' + twin.key + ' had the same home but step ' + twin.step + (twin.step === step ? ', the same: these two do share a path.' : ', so their paths split after the first probe.') : '');
          break;
        }
        case 'full': {
          const seen = [...new Set(path)].sort((a, b) => a - b);
          const empties = d.t.filter((v) => v === EMPTY).length;
          say = M + ' probes reached only slots ' + seen.join(', ') + '. ' + (empties ? 'M = ' + M + ' and step ' + step + ' share a factor, so the probes cycle through ' + seen.length + ' slots while ' + empties + ' stay EMPTY. With M prime every step reaches every slot.' : 'The table is full.');
          break;
        }
        case 'after': say = memo.calls < inp.ins.length ? (memo.result === -1 ? key + ' could not be stored.' : key + ' is in slot ' + memo.result + '.') + ' Next key.' : (memo.result === -1 ? key + ' could not be stored: with step ' + step + ' and M = ' + M + ' the probes cycle. ' : '') + 'Steps used: ' + memo.steps.map((s) => s.key + ' → ' + s.step).join(', ') + '. Probes per insert: ' + memo.probes.join(', ') + '.'; break;
      }
      return { items, say, slow: tag === 'place' };
    },
    predict: [
      { at: (t) => t.tag === 'hash2', once: true, ask: (t) => 'The home slot ' + t.data.h + ' is taken. Which slot is probed second? Click it.', answer: (ts, i) => { const d = ts[i].data, st = 1 + d.key % (d.M - 1); return d.t[d.h] >= 0 ? 'slot' + (d.h + st) % d.M : null; }, explain: (ts, i) => { const d = ts[i].data, st = 1 + d.key % (d.M - 1); return '(h + step) % M = (' + d.h + ' + ' + st + ') % ' + d.M + ' = ' + (d.h + st) % d.M + '.'; } },
      { at: (t, i, ts) => t.tag === 'hash2' && ts.slice(0, i).some((x) => x.tag === 'hash2'), once: true, ask: (t) => 'How many probes will ' + t.data.key + ' need, with step ' + (1 + t.data.key % (t.data.M - 1)) + '?', options: () => ['1', '2', '3', '4', '5', '6'], answer: (ts, i) => { let n = 0; for (let j = i + 1; j < ts.length && ts[j].tag !== 'hash'; j++) if (ts[j].tag === 'probe') n++; return n <= 6 ? String(n) : null; }, pick: 'option', explain: () => 'Hop step slots at a time from home, wrapping round, until a slot is free.' },
    ],
    quiz: [
      { q: 'With M = 11, key 46 has home 2 and step 1 + 46 % 10 = 7. What are its first three probes?', options: ['2, 3, 4', '2, 9, 5', '2, 9, 16', '2, 7, 14'], answer: 1, why: '2, then 2 + 7 = 9, then 2 + 14 = 16, and 16 % 11 = 5.' },
      { q: 'Why must hash2 never return 0?', options: ['It would divide by zero', 'Every probe would land on the home slot again', 'It is slower', 'It may'], answer: 1, why: 'h + i × 0 is always h: the key would never leave its home.' },
      { q: 'What does double hashing fix that quadratic probing does not?', options: ['Primary clustering only', 'Secondary clustering: keys with the same home no longer share one probe sequence', 'Deletion', 'Nothing'], answer: 1, why: 'The step depends on the key, not just on its home slot.' },
      { q: 'Why is M usually prime for double hashing?', options: ['Primes hash faster', 'So every step from 1 to M - 1 visits all slots before repeating', 'To avoid negative keys', 'It is not'], answer: 1, why: 'If the step and M share a factor, the probes cycle through only some of the slots.' },
    ],
    compareWith: 'oa-quadratic',
  });

  // ---- delete with tombstones ------------------------------------------------------------------------------
  X.topic({
    id: 'oa-delete', family: 'oaddr', order: 50, title: 'Delete: tombstones',
    blurb: 'Deleting a key leaves a DELETED marker, not an EMPTY slot, so searches for keys further along its probe chain still get through.',
    code: (inp) => SEARCH + `

/* remove key; returns 1 if it was there */
int delete_key(int key)
{
    int slot = search(key);           /*@ find */
    if (slot == -1)                   /*@ check */
        return 0;                     /*@ nothing */
${inp.mark === 'EMPTY' ? '    table[slot] = EMPTY;              /* wrong: cuts probe chains */ /*@ mark */' : '    table[slot] = DELETED;            /*@ mark */'}
    return 1;                         /*@ ok */
}`,
    animate: ['delete_key', 'search'], quiet: ['hash'],
    inputs: [
      preIn([12, 23, 34, 5]), mIn(11),
      { id: 'del', kind: 'int', label: 'Delete', def: 23, lo: 0, hi: 999 },
      { id: 'find', kind: 'int', label: 'Then search for', def: 34, lo: 0, hi: 999 },
      { id: 'mark', kind: 'choice', label: 'Delete writes', def: 'DELETED', options: [{ value: 'DELETED', label: 'DELETED (a tombstone)' }, { value: 'EMPTY', label: 'EMPTY (the mistake)' }] },
    ],
    check: (inp) => {
      if (inp.mark !== 'DELETED' && inp.mark !== 'EMPTY') return 'Delete writes: DELETED or EMPTY';
      if (inp.keys.length >= inp.m) return 'Leave at least one slot EMPTY: at most ' + (inp.m - 1) + ' keys';
      return null;
    },
    presets: [
      { label: 'A tombstone keeps 34 reachable', values: { keys: [12, 23, 34, 5], m: 11, del: 23, find: 34, mark: 'DELETED' } },
      { label: 'Writing EMPTY loses 34', values: { keys: [12, 23, 34, 5], m: 11, del: 23, find: 34, mark: 'EMPTY' } },
      { label: 'Search for the deleted key', values: { keys: [12, 23, 34, 5], m: 11, del: 23, find: 23, mark: 'DELETED' } },
      { label: 'Delete a key that is not there', values: { keys: [12, 23, 34, 5], m: 11, del: 45, find: 34, mark: 'DELETED' } },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => OA.main(inp, 'linear', ['delete_key(' + inp.del + ');', 'search(' + inp.find + ');']),
    capture: OA.capture,
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, memo = ctx.memo, M = d.M;
      const inDelete = d.calls.includes('delete_key');
      if (tag === 'enter' || (inDelete && !memo.phase)) memo.phase = 'delete';
      if (tag === 'hash' && !inDelete) { memo.phase = 'search'; memo.result = undefined; }
      const path = OA.track(ctx);
      if (tag === 'enter') { memo.key = inp.del; memo.h = inp.del % M; }
      const st = searchStep(d, tag, memo, path);
      const cur = st.cur, key = memo.key, h = memo.h;
      if (tag === 'found') memo.result = cur;
      if (tag === 'mark') { memo.marked = memo.result; }
      const searching = memo.phase === 'search';
      const lines = ['delete_key(' + inp.del + ')' + (memo.marked !== undefined ? ': slot ' + memo.marked + ' ← ' + inp.mark : searching && memo.delFail ? ': not there' : '')];
      if (tag === 'nothing') memo.delFail = true;
      if (searching) lines.push('search(' + inp.find + ')' + (tag === 'after' ? (memo.result !== undefined ? ': slot ' + memo.result : ': -1, not found') : ''));
      if (path.length && tag !== 'after' && !['mark', 'ok', 'check', 'nothing'].includes(tag)) lines.push('probe ' + (path.length - 1) + ': (' + h + ' + ' + (path.length - 1) + ') % ' + M + ' = ' + cur);
      // the honest consequence of writing EMPTY: the key is still there, out of reach
      const lostAt = searching && inp.mark === 'EMPTY' && (tag === 'missing' || tag === 'after') && memo.result === undefined ? d.t.indexOf(inp.find) : -1;
      const notes = [];
      if (lostAt >= 0) notes.push({ slot: lostAt, text: inp.find + ' is still here, never reached', cls: 'bad', y: 120 });
      if (searching && tag === 'match' && d.t[cur] === DELETED) notes.push({ slot: cur, text: 'EMPTY here would end the search', cls: 'note', y: 120 });
      if (tag === 'mark') notes.push({ slot: cur !== null ? memo.marked : 0, text: inp.mark === 'DELETED' ? 'tombstone' : 'looks never used', cls: inp.mark === 'DELETED' ? 'note' : 'bad', y: 120 });
      const items = OA.draw(ctx, d, {
        path: ['mark', 'ok'].includes(tag) ? [] : path, home: tag === 'enter' ? null : h, hopLabel: (k, a, b) => (b < a ? '+1, wrap' : '+1'),
        cellCls: (i, v) => (i === lostAt ? 'oa-wrong' : memo.result === i && !['mark', 'ok'].includes(tag) ? 'part-a' : i === cur && tag !== 'after' && !['mark', 'ok'].includes(tag) ? (v === EMPTY && tag !== 'probe' ? 'bad' : 'focus') : path.includes(i) && !['mark', 'ok'].includes(tag) ? 'oa-seen' : ''),
        flash: tag === 'mark' ? memo.marked : null,
        token: tag === 'enter' || tag === 'hash' ? 'box' : ['mark', 'ok', 'check', 'nothing', 'find'].includes(tag) ? (memo.marked !== undefined ? memo.marked : null) : cur, key, verdict: st.verdict,
        lines, hotLine: lines.length - 1, boxTitle: searching ? 'after the delete, a search' : 'delete = search, then mark the slot', seq: OA.seqText(path), notes,
      });
      let say = st.say;
      switch (tag) {
        case 'enter': say = 'delete_key(' + inp.del + '): first find it, with the same probing a search uses, then mark its slot ' + inp.mark + '. Afterwards, search(' + inp.find + ') shows whether the table still works.'; break;
        case 'hash': if (!searching) say = 'delete_key calls search(' + key + '). ' + st.say; else say = 'Now search(' + key + '), after the delete. hash(' + key + ') = ' + h + '.'; break;
        case 'found': if (!searching) say = 'search finds ' + key + ' in slot ' + cur + ' and returns it to delete_key.'; break;
        case 'missing': if (!searching) say = 'search returns -1: ' + key + ' is not in the table.'; else if (lostAt >= 0) say = 'search returns -1, but ' + inp.find + ' is in slot ' + lostAt + '. Writing EMPTY at slot ' + memo.marked + ' cut its probe chain: the table now lies.'; break;
        case 'find': say = 'search(' + inp.del + ') returned ' + (memo.result !== undefined ? memo.result : -1) + ': slot = ' + (memo.result !== undefined ? memo.result : -1) + '.'; break;
        case 'check': say = memo.result !== undefined ? 'slot is ' + memo.result + ', not -1: the key is there.' : 'slot is -1: nothing to delete.'; break;
        case 'nothing': say = 'delete_key returns 0. The table is unchanged.'; break;
        case 'mark': say = inp.mark === 'DELETED' ? 'table[' + memo.marked + '] = DELETED. The key is gone, but the slot is marked: a search passing through will not stop here, and an insert may reuse it.' : 'table[' + memo.marked + '] = EMPTY. The key is gone, and the slot now looks as if it was never used. Any key that probed past it when it was inserted is now cut off.'; break;
        case 'ok': say = 'delete_key returns 1.'; break;
        case 'after':
          if (!searching) say = 'The delete is done. Now search for ' + inp.find + '.';
          else if (memo.result !== undefined) say = inp.find + ' was found in slot ' + memo.result + (path.some((s) => d.t[s] === DELETED) ? ', reached through the tombstone. With EMPTY there, the search would have stopped short.' : '.');
          else if (lostAt >= 0) say = 'Wrong answer: ' + inp.find + ' is in the table but search says it is not. This is why delete writes DELETED, not EMPTY.';
          else say = inp.find + ' is not in the table, and the search rightly says so' + (path.some((s) => d.t[s] === DELETED) ? ', after going past the tombstone to the first EMPTY slot.' : '.');
          break;
      }
      return { items, say, slow: tag === 'mark' || lostAt >= 0 };
    },
    predict: [
      { at: (t) => t.tag === 'check', once: true, ask: 'The key was found. What should its slot be set to?', options: () => ['EMPTY', 'DELETED'], answer: (ts, i, ctx) => (ctx.input.mark === 'DELETED' && ts.slice(i).some((t) => t.tag === 'mark') ? 'DELETED' : null), pick: 'option', explain: () => 'DELETED. EMPTY would make later searches stop early at this slot and miss keys placed beyond it.' },
      { at: (t) => t.tag === 'hash' && !t.data.calls.includes('delete_key'), once: true, ask: (t) => 'Will search(' + t.data.key + ') find it?', options: () => ['Yes', 'No'], answer: (ts) => (ts.some((t) => t.tag === 'found' && !t.data.calls.includes('delete_key')) ? 'Yes' : 'No'), pick: 'option', explain: (ts, i, ctx) => (ctx.input.mark === 'EMPTY' ? 'The EMPTY slot in its probe chain stops the search early.' : 'Tombstones do not stop a search; only the key or an EMPTY slot does.') },
    ],
    quiz: [
      { q: '12, 23 and 34 all hash to slot 1 (M = 11) and sit in slots 1, 2, 3. 23 is deleted by writing EMPTY. What does search(34) return?', options: ['3', '-1', '2', '1'], answer: 1, why: 'It probes 1 (12), then 2, finds EMPTY and stops, though 34 is in slot 3.' },
      { q: 'What does a search do at a DELETED slot?', options: ['Stops: not found', 'Goes on to the next probe', 'Returns that slot', 'Restarts'], answer: 1, why: 'A tombstone is neither the key nor proof of absence.' },
      { q: 'Can insert reuse a DELETED slot?', options: ['No, never', 'Yes: it is free space', 'Only if it is the home slot', 'Only after a rehash'], answer: 1, why: 'Nothing lives there. Reusing it keeps the table from filling with tombstones.' },
      { q: 'What is the cost of many tombstones?', options: ['None', 'Searches walk past them, so failed searches get longer until the table is rebuilt', 'They use extra memory per slot', 'They change hash()'], answer: 1, why: 'Only EMPTY ends a failed search; tombstones make the chains look longer than the keys justify.' },
      { q: 'Why is deletion simple with chaining but tricky with open addressing?', options: ['It is not', 'With chaining a key lives in its own bucket\'s list; with open addressing other keys\' probe paths run through its slot', 'Chaining has no deletion', 'Open addressing has no hash'], answer: 1, why: 'Emptying an open addressing slot can cut the path to keys stored further along.' },
    ],
    compareWith: 'chain-delete',
  });
})(SEE);
