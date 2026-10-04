// Two topics side by side on the same data, stepping together: bubble sort against insertion sort,
// BFS against DFS. Each side keeps its own counters, so the difference in work is plain to see.
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  const { h, icon } = SEE.UI;
  const store = SEE.UI.storage;
  const SPEEDS = [1700, 1150, 800, 560, 380, 240];
  const NAMES = { compares: 'comparisons', swaps: 'swaps', moves: 'moves', follows: 'pointer steps', allocs: 'mallocs', frees: 'frees', writes: 'writes' };

  /** Pairs worth comparing: every topic's compareWith, once each */
  function pairs() {
    const out = [], seen = new Set();
    for (const t of X.topics) {
      const o = t.compareWith && X.byId(t.compareWith);
      if (!o) continue;
      const k = [t.id, o.id].sort().join(',');
      if (seen.has(k)) continue;
      seen.add(k);
      out.push([t, o]);
    }
    return out;
  }

  /** The inputs the two topics share (same id and kind): one box drives both */
  function shared(a, b) {
    return (a.inputs || []).filter((i) => i.kind !== 'hidden' && (b.inputs || []).some((j) => j.id === i.id && j.kind === i.kind));
  }

  class Side {
    constructor(el, t) {
      this.t = t;
      this.el = el;
      this.wrap = h('div.stage-wrap.cmp-stage');
      this.stage = new X.Stage(this.wrap);
      this.say = h('div.say');
      this.counters = h('div.counters');
      el.append(h('div.cmp-head', h('h3', t.title), h('a', { href: '#topic=' + t.id }, 'Open on its own')), this.wrap, this.say, this.counters);
      this.i = 0;
    }
    run(input) {
      const r = X.run(this.t, input);
      this.frames = !r.ok ? [{ items: [], say: 'This input does not suit ' + this.t.title + ': ' + r.errors.join('; ') }] : r.frames.length ? r.frames : [{ items: [], say: 'With this data ' + this.t.title + ' has nothing to do.' }];
      this.i = 0;
      this.stage.clear();
      this.go(0, true);
    }
    go(i, instant, dur) {
      this.i = Math.max(0, Math.min(this.frames.length - 1, i));
      const fr = this.frames[this.i];
      this.stage.show(fr, { duration: instant ? 0 : dur });
      this.say.innerHTML = '';
      this.say.append(h('span.step', this.i === this.frames.length - 1 ? 'Finished' : 'Step ' + (this.i + 1) + ' of ' + this.frames.length), document.createTextNode(fr.say || ''));
      const c = fr.counters || {};
      this.counters.innerHTML = '';
      for (const k of this.t.counters || ['compares', 'follows', 'allocs']) this.counters.appendChild(h('div.counter', h('b', String(c[k] || 0)), h('span', NAMES[k] || k)));
    }
    get done() { return this.i >= this.frames.length - 1; }
  }

  X.Compare = {
    pairs,
    render(app, main, arg) {
      const ids = (arg || '').split(',').filter(Boolean);
      const a = X.byId(ids[0]), b = X.byId(ids[1]);
      if (!a || !b) { this.chooser(main, a); return; }
      this.view(app, main, a, b);
    },
    chooser(main, first) {
      const box = h('div.home');
      box.append(h('h1', 'Compare'), h('p.lead', 'Run two algorithms on the same data, side by side, step for step. Watch which one does less work, and where they part ways.'));
      const grid = h('div.fam-grid');
      for (const [a, b] of pairs()) {
        const card = h('button.fam-card', { type: 'button' }, h('h3', a.title + ' vs ' + b.title), h('p', X.familyOf(a).title + (X.familyOf(b) !== X.familyOf(a) ? ' · ' + X.familyOf(b).title : '')));
        card.addEventListener('click', () => { location.hash = 'compare=' + a.id + ',' + b.id; });
        grid.appendChild(card);
      }
      box.appendChild(grid);
      // any two topics
      const opt = (sel) => X.topics.map((t) => h('option', { value: t.id, selected: sel && sel.id === t.id }, X.familyOf(t).title + ': ' + t.title));
      const s1 = h('select', { id: 'cmpA', 'aria-label': 'First topic' }, ...opt(first));
      const s2 = h('select', { id: 'cmpB', 'aria-label': 'Second topic' }, ...opt(null));
      const go = h('button.btn.primary', { type: 'button', id: 'cmpGo' }, 'Compare');
      go.addEventListener('click', () => { location.hash = 'compare=' + s1.value + ',' + s2.value; });
      box.append(h('h2', { style: { marginTop: '28px', fontSize: '18px' } }, 'Or pick any two'), h('div.cmp-pick', s1, s2, go));
      main.appendChild(box);
    },
    view(app, main, a, b) {
      document.title = a.title + ' vs ' + b.title + ' · Strux';
      const root = h('div.topic.compare', { id: 'compareView' });
      const sh = shared(a, b);
      let input = Object.assign({}, X.inputOf(a, store.get('in:' + a.id, null)));
      const ib = X.inputOf(b, store.get('in:' + b.id, null));
      const fields = {};
      const bar = h('div.inputs');
      const err = h('div.err');
      for (const inp of sh) {
        const v = input[inp.id];
        const f = h('input', { type: inp.kind === 'int' ? 'number' : 'text', value: inp.kind === 'ints' ? (v || []).join(' ') : String(v), 'aria-label': inp.label, id: 'cmp-in-' + inp.id });
        f.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
        fields[inp.id] = { inp, f };
        bar.appendChild(h('label', inp.label, f));
      }
      const runBtn = h('button.btn.primary', { type: 'button', id: 'cmpRun' }, icon('run'), 'Run both');
      runBtn.addEventListener('click', () => apply());
      if (sh.length) bar.append(runBtn, err);
      root.append(h('div.t-head', h('div', h('div.crumbs', h('a', { href: '#compare' }, 'Compare')), h('h1', a.title + ' vs ' + b.title),
        h('p', sh.length ? 'Both run on the same ' + sh.map((i) => i.label.toLowerCase().replace(/^the /, '').replace(/\s*\(.*\)$/, '')).join(' and ') + '.' : 'Each runs on its own example data.'))));
      if (sh.length) root.appendChild(bar);
      const grid = h('div.cmp-grid');
      const L = h('div.card.cmp-side'), R = h('div.card.cmp-side');
      grid.append(L, R);
      root.appendChild(grid);
      const left = new Side(L, a), right = new Side(R, b);
      // controls shared by both sides
      let playing = false, timer = null;
      const playBtn = h('button.icon-btn.play', { type: 'button', id: 'cmpPlay', 'aria-label': 'Play' }, icon('run'));
      const setPlay = (on) => { playing = on; playBtn.innerHTML = ''; playBtn.appendChild(icon(on ? 'pause' : 'run')); playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play'); };
      const dur = () => Math.min(SPEEDS[app.settings.speed] * 0.75, 650);
      const step = (d) => { left.go(left.i + d, false, dur()); right.go(right.i + d, false, dur()); };
      const tick = () => {
        clearTimeout(timer);
        if (!playing || !document.body.contains(root)) return;
        if (left.done && right.done) { setPlay(false); return; }
        step(1);
        timer = setTimeout(tick, SPEEDS[app.settings.speed]);
      };
      playBtn.addEventListener('click', () => { if (playing) { setPlay(false); clearTimeout(timer); } else { if (left.done && right.done) { left.go(0, true); right.go(0, true); } setPlay(true); tick(); } });
      const ibtn = (id, ic, title, fn) => { const x = h('button.icon-btn', { type: 'button', id, title, 'aria-label': title }, icon(ic)); x.addEventListener('click', () => { setPlay(false); clearTimeout(timer); fn(); }); return x; };
      const speed = h('input', { type: 'range', min: '0', max: String(SPEEDS.length - 1), value: String(app.settings.speed), 'aria-label': 'Speed' });
      speed.addEventListener('input', () => { app.settings.speed = +speed.value; app.saveSettings(); });
      grid.before(h('div.card.controls.cmp-controls', ibtn('cmpFirst', 'restart', 'From the start', () => { left.go(0); right.go(0); }), ibtn('cmpBack', 'stepBack', 'Step back', () => step(-1)), playBtn, ibtn('cmpFwd', 'stepOver', 'Next step', () => step(1)), h('label.speed', h('span', 'Speed'), speed)));
      main.appendChild(root);
      const apply = () => {
        const next = Object.assign({}, input);
        for (const [id, { inp, f }] of Object.entries(fields)) next[id] = inp.kind === 'ints' ? (f.value.trim() ? f.value.trim().split(/[\s,]+/).map(Number) : []) : inp.kind === 'int' ? Number(f.value) : f.value;
        const e = X.checkInput(a, next) || X.checkInput(b, Object.assign({}, ib, pick(next)));
        err.textContent = e || '';
        if (e) return;
        input = next;
        go();
      };
      const pick = (o) => { const r = {}; for (const i of sh) r[i.id] = o[i.id]; return r; };
      const go = () => {
        setPlay(false); clearTimeout(timer);
        left.run(input);
        // a value that suits one topic may not suit the other (a capacity of 1 for pushing, say): then it keeps its own
        const rb = Object.assign({}, ib, pick(input));
        right.run(X.checkInput(b, rb) ? ib : rb);
      };
      go();
      this.current = { left, right, step };
    },
  };
})(SEE);
