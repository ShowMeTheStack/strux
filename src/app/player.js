// The topic player: inputs, the stage with its narration and controls, the code and counters, the call
// stack, predictions and the quiz.
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  const { h, icon } = SEE.UI;
  const store = SEE.UI.storage;
  const SPEEDS = [1700, 1150, 800, 560, 380, 240];

  class Player {
    constructor(app, main, topic, input) {
      this.app = app;
      this.t = topic;
      this.f = X.familyOf(topic);
      this.input = input;
      this.i = 0;
      this.frames = [];
      this.playing = false;
      this.timer = null;
      this.answered = new Set();
      this.root = h('div.topic', { dataset: { topic: topic.id } });
      main.appendChild(this.root);
      this.build();
      this.run();
    }
    dispose() { this.pause(); this.disposed = true; }

    // ---- layout -------------------------------------------------------------------------------------
    build() {
      const t = this.t;
      const quiz = h('button.btn', { type: 'button', id: 'btnQuiz', disabled: !(t.quiz && t.quiz.length) }, icon('check'), 'Quiz');
      quiz.addEventListener('click', () => this.quiz());
      const see = h('button.btn', { type: 'button', id: 'btnSee', title: 'Open this program in See, the C workbench, to change it and run it yourself' }, icon('edit'), 'Open in See');
      see.addEventListener('click', () => this.openInSee());
      const cmp = t.compareWith ? h('button.btn', { type: 'button', id: 'btnCompare' }, icon('grid'), 'Compare') : null;
      if (cmp) cmp.addEventListener('click', () => { location.hash = 'compare=' + t.id + ',' + t.compareWith; });
      this.root.appendChild(h('div.t-head',
        h('div', h('div.crumbs', this.f.group + ' › ' + this.f.title), h('h1', t.title), h('p', t.blurb || '')),
        h('div.t-actions', quiz, cmp, see)));
      this.inputsEl = h('div.inputs', { id: 'inputs' });
      this.root.appendChild(this.inputsEl);
      this.buildInputs();
      // stage
      this.stageWrap = h('div.stage-wrap', { id: 'stageWrap' });
      this.stage = new X.Stage(this.stageWrap);
      this.stage.onPick = (key) => this.pick(key);
      this.sayEl = h('div.say', { id: 'say', 'aria-live': 'polite' });
      this.playBtn = h('button.icon-btn.play', { type: 'button', id: 'btnPlay', 'aria-label': 'Play', title: 'Play (Space)' }, icon('run'));
      this.playBtn.addEventListener('click', () => this.toggle());
      const ib = (id, ic, title, fn) => { const b = h('button.icon-btn', { type: 'button', id, 'aria-label': title, title }, icon(ic)); b.addEventListener('click', fn); return b; };
      this.backBtn = ib('btnBack', 'stepBack', 'Step back (←)', () => this.step(-1));
      this.fwdBtn = ib('btnFwd', 'stepOver', 'Next step (→)', () => this.step(1));
      const first = ib('btnFirst', 'restart', 'From the start (Home)', () => { this.pause(); this.go(0); });
      this.range = h('input', { type: 'range', min: '0', max: '0', value: '0', id: 'timeline', 'aria-label': 'Timeline' });
      this.range.addEventListener('input', () => { this.pause(); this.go(+this.range.value, true); });
      this.marks = h('div.marks');
      const speed = h('input', { type: 'range', min: '0', max: String(SPEEDS.length - 1), value: String(this.app.settings.speed), id: 'speed', 'aria-label': 'Speed' });
      speed.addEventListener('input', () => { this.app.settings.speed = +speed.value; this.app.saveSettings(); });
      this.posEl = h('span.pos', { id: 'pos' });
      const big = ib('btnBig', 'full', 'A bigger stage', () => { this.stageWrap.classList.toggle('big'); this.redraw(); });
      // zoom: buttons on the stage, pinch or ctrl+wheel, and drag to look around
      this.stage.enableZoom();
      const zIn = h('button.icon-btn.zbtn', { type: 'button', id: 'btnZoomIn', 'aria-label': 'Zoom in', title: 'Zoom in' }, '+');
      const zOut = h('button.icon-btn.zbtn', { type: 'button', id: 'btnZoomOut', 'aria-label': 'Zoom out', title: 'Zoom out' }, '−');
      const zFit = h('button.icon-btn.zbtn', { type: 'button', id: 'btnZoomFit', 'aria-label': 'Fit to the stage', title: 'Fit to the stage' }, '1:1');
      zIn.addEventListener('click', () => this.stage.setZoom((this.stage.zoom || 1) * 1.4, true));
      zOut.addEventListener('click', () => this.stage.setZoom((this.stage.zoom || 1) / 1.4, true));
      zFit.addEventListener('click', () => this.stage.setZoom(1));
      const zoomBox = h('div.zoom', zIn, zOut, zFit);
      this.stage.onZoom = (z) => { zOut.disabled = z <= 1; zFit.disabled = z <= 1; this.stageWrap.classList.toggle('zoomed', z > 1); };
      this.stage.onZoom(1);
      this.stageWrap.appendChild(zoomBox);
      const controls = h('div.controls', first, this.backBtn, this.playBtn, this.fwdBtn, h('div.timeline', this.range, this.marks), this.posEl, h('label.speed', h('span', 'Speed'), speed), big);
      const stageCard = h('div.card.stage-card', this.stageWrap, this.sayEl, controls);
      // side: code, memory, calls; counters
      this.tabs = {};
      const tabBar = h('div.tabs', { role: 'tablist' });
      this.tabBody = h('div.tab-body', { id: 'tabBody' });
      for (const [k, label] of [['code', 'Code'], ['memory', 'Memory'], ['calls', 'Calls'], ['output', 'Output']]) {
        const b = h('button', { type: 'button', role: 'tab', id: 'tab-' + k }, label);
        b.addEventListener('click', () => this.showTab(k));
        tabBar.appendChild(b);
        this.tabs[k] = b;
      }
      this.countersEl = h('div.counters', { id: 'counters' });
      const sideCard = h('div.card.side-card', tabBar, this.tabBody, this.countersEl);
      this.root.appendChild(h('div.work', stageCard, sideCard));
      this.tab = store.get('tab', 'code');
    }

    buildInputs() {
      const t = this.t, el = this.inputsEl;
      el.innerHTML = '';
      this.fields = {};
      for (const inp of t.inputs || []) {
        let field;
        const v = this.input[inp.id];
        if (inp.kind === 'hidden') continue;
        if (inp.kind === 'ints') field = h('input', { type: 'text', value: (v || []).join(' '), size: '22', 'aria-label': inp.label, id: 'in-' + inp.id, inputmode: 'numeric', placeholder: 'numbers, like 3 1 4' });
        else if (inp.kind === 'int') field = h('input', { type: 'number', value: String(v), 'aria-label': inp.label, id: 'in-' + inp.id, style: { width: '96px' } });
        else if (inp.kind === 'choice') { field = h('select', { id: 'in-' + inp.id, 'aria-label': inp.label }, ...inp.options.map((o) => h('option', { value: o.value, selected: o.value === v }, o.label))); }
        else field = h('input', { type: 'text', value: String(v === undefined ? '' : v), 'aria-label': inp.label, id: 'in-' + inp.id });
        field.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.apply(); } });
        this.fields[inp.id] = { inp, field };
        el.appendChild(h('label', inp.label, field));
      }
      const go = h('button.btn.primary', { type: 'button', id: 'btnRun' }, icon('run'), 'Run');
      go.addEventListener('click', () => this.apply());
      el.appendChild(go);
      // graph topics: draw the graph by hand
      const gin = (t.inputs || []).find((i) => i.id === 'graph');
      if (gin && X.editGraph && (t.inputs || []).some((i) => i.id === 'n')) {
        const ed = h('button.btn', { type: 'button', id: 'btnEditGraph' }, icon('edit'), 'Draw the graph');
        ed.addEventListener('click', () => {
          X.editGraph(this.input, gin, t.inputs.find((i) => i.id === 'n')).then((g) => {
            if (!g) return;
            const next = Object.assign({}, this.input, g);
            const e = X.checkInput(t, next);
            if (e) { this.errEl.textContent = e; return; }
            this.input = next;
            store.set('in:' + t.id, next);
            this.buildInputs();
            this.run();
          });
        });
        el.appendChild(ed);
      }
      if (t.presets && t.presets.length) {
        const ps = h('div.presets');
        for (const p of t.presets) {
          const c = h('button.chip', { type: 'button' }, p.label);
          c.addEventListener('click', () => { this.input = Object.assign({}, this.input, p.values); this.buildInputs(); this.run(); });
          ps.appendChild(c);
        }
        el.appendChild(ps);
      }
      this.errEl = h('div.err', { id: 'inputErr' });
      el.appendChild(this.errEl);
    }
    /** Read the fields, check them and run again */
    apply() {
      const next = Object.assign({}, this.input);
      for (const [id, { inp, field }] of Object.entries(this.fields)) {
        if (inp.kind === 'ints') next[id] = field.value.trim() ? field.value.trim().split(/[\s,]+/).map((x) => Number(x)) : [];
        else if (inp.kind === 'int') next[id] = Number(field.value);
        else next[id] = field.value;
      }
      // positions belong to the graph they came with: a changed graph is laid out afresh
      if (next.pos && (next.graph !== this.input.graph || next.n !== this.input.n)) delete next.pos;
      const e = X.checkInput(this.t, next);
      this.errEl.textContent = e || '';
      if (e) return;
      this.input = next;
      store.set('in:' + this.t.id, next);
      this.run();
    }

    // ---- running ---------------------------------------------------------------------------------------
    run() {
      this.pause();
      const res = X.run(this.t, this.input);
      this.res = res;
      if (!res.ok) {
        this.frames = [{ items: [], say: 'The program did not build: ' + res.errors.join('; ') }];
        this.code = res.code;
      } else {
        this.frames = res.frames.length ? res.frames : [{ items: [], say: 'Nothing happened with this input.' }];
        this.code = res.code;
      }
      this.answered = new Set();
      this.stage.clear();
      this.range.max = String(this.frames.length - 1);
      this.marks.innerHTML = '';
      this.frames.forEach((f, i) => {
        if (f.predict || f.key) {
          const m = h('i' + (f.predict ? '.q' : ''));
          m.style.left = (this.frames.length > 1 ? (i / (this.frames.length - 1)) * 100 : 0) + '%';
          this.marks.appendChild(m);
        }
      });
      this.codeRange = this.findRange();
      this.renderCode();
      this.go(0, true);
      this.showTab(this.tab);
    }
    /** The lines of the topic's own functions, to light them and dim the rest */
    findRange() {
      const lines = (this.code || '').split('\n');
      const names = this.t.animate || [];
      let lo = Infinity, hi = -1;
      for (const n of names) {
        const re = new RegExp('^[A-Za-z_][^;(]*\\b' + n + '\\s*\\(');
        const i = lines.findIndex((l) => re.test(l) && !/;\s*$/.test(l));
        if (i < 0) continue;
        let j = i, depth = 0, seen = false;
        for (; j < lines.length; j++) { for (const ch of lines[j]) { if (ch === '{') { depth++; seen = true; } if (ch === '}') depth--; } if (seen && depth === 0) break; }
        let s = i; while (s > 0 && /^\s*(\/\*|\*)/.test(lines[s - 1])) s--;
        lo = Math.min(lo, s + 1); hi = Math.max(hi, j + 1);
      }
      return hi < 0 ? null : [lo, hi];
    }
    renderCode() {
      const box = h('div.code', { id: 'code' });
      const lines = (this.code || '').split('\n');
      let st = 0;
      this.lineEls = [];
      lines.forEach((l, i) => {
        const el = h('span.ln', { html: SEE.CLang.highlightLine(l, st) || ' ', dataset: { line: String(i + 1) } });
        st = SEE.CLang.depthAfter(l, st);
        if (this.codeRange && (i + 1 < this.codeRange[0] || i + 1 > this.codeRange[1])) el.classList.add('dimmed');
        if (this.frames.some((f) => f.line === i + 1)) {
          el.classList.add('click');
          el.title = 'Go to the next time this line runs';
          el.addEventListener('click', () => this.toLine(i + 1));
        }
        this.lineEls.push(el);
        box.appendChild(el);
      });
      this.codeBox = box;
    }
    toLine(line) {
      this.pause();
      for (let k = 1; k <= this.frames.length; k++) {
        const j = (this.i + k) % this.frames.length;
        if (this.frames[j].line === line) { this.go(j); return; }
      }
    }
    showTab(k) {
      this.tab = k;
      store.set('tab', k);
      for (const [key, b] of Object.entries(this.tabs)) b.classList.toggle('on', key === k);
      const body = this.tabBody;
      body.innerHTML = '';
      if (k === 'code') { body.appendChild(this.codeBox); this.scrollCode(); }
      else if (k === 'calls') body.appendChild(this.callsView());
      else if (k === 'memory') body.appendChild(this.memoryView());
      else body.appendChild(h('pre', { style: { padding: '10px 14px', margin: 0, font: '13px/1.5 var(--mono)', whiteSpace: 'pre-wrap' } }, (this.res && this.res.output) || 'This program prints nothing.'));
    }
    callsView() {
      const box = h('div.calls', { id: 'callsView' });
      const fr = this.frames[this.i];
      const calls = (fr && fr.calls) || [];
      if (!calls.length) { box.appendChild(h('div.muted', 'The calls waiting on the stack show here: each recursive call is a frame of its own.')); return box; }
      box.appendChild(h('div.sec-t', 'The stack now (newest on top)'));
      const args = (c) => Object.entries(c.args || {}).map(([k, v]) => k + '=' + String(v).replace(/ -> .*/, '')).join(', ');
      calls.slice().reverse().forEach((c, i) => box.appendChild(h('div.frame' + (i === 0 ? '.top' : ''), c.fn + '(' + args(c) + ')')));
      const tree = this.recursionTree();
      if (tree) { box.appendChild(h('div.sec-t', 'Every call so far')); box.appendChild(tree); }
      return box;
    }
    /** The tree of calls to the topic's functions up to this step: when a function calls itself */
    recursionTree() {
      const log = this.res && this.res.rec && this.res.rec.callLog;
      if (!log) return null;
      // the topic's own calls: everything below main
      const all = log.filter((c) => c.depth >= 1);
      if (all.length < 3 || !all.some((c) => all.some((d) => d.id === c.parent && d.fn === c.fn) || all.some((d) => d.parent === c.id && d.fn !== c.fn && all.some((e) => e.parent === c.id && e !== d)))) return null;
      const i = this.i;
      const fr = this.frames[i];
      const onPath = new Set((fr.calls || []).map((c) => c.id));
      const seen = all.filter((c) => c.from <= i);
      if (!seen.length) return null;
      const ids = new Set(seen.map((c) => c.id));
      const kids = new Map();
      const roots = [];
      for (const c of seen) { if (ids.has(c.parent)) { if (!kids.has(c.parent)) kids.set(c.parent, []); kids.get(c.parent).push(c); } else roots.push(c); }
      const W = 128, H = 30, GX = 10, GY = 22;
      const pos = new Map();
      let leaf = 0, maxD = 0;
      const place = (c, d) => {
        maxD = Math.max(maxD, d);
        const ch = kids.get(c.id) || [];
        if (!ch.length) { pos.set(c.id, { x: leaf++ * (W + GX), y: d * (H + GY) }); return; }
        ch.forEach((k) => place(k, d + 1));
        const xs = ch.map((k) => pos.get(k.id).x);
        pos.set(c.id, { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: d * (H + GY) });
      };
      roots.forEach((r) => place(r, 0));
      const wTot = Math.max(1, leaf) * (W + GX), hTot = (maxD + 1) * (H + GY);
      const NS = 'http://www.w3.org/2000/svg';
      const el = (n, a, txt) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (txt !== undefined) e.textContent = txt; return e; };
      const svgEl = el('svg', { viewBox: '-4 -4 ' + (wTot + 8) + ' ' + (hTot + 8), class: 'rtree' });
      // never smaller than readable: a wide tree scrolls sideways instead
      svgEl.style.width = Math.max(wTot, 200) + 'px';
      svgEl.style.minWidth = '100%';
      for (const c of seen) {
        if (!ids.has(c.parent)) continue;
        const a = pos.get(c.parent), b = pos.get(c.id);
        svgEl.appendChild(el('path', { d: 'M' + (a.x + W / 2) + ',' + (a.y + H) + ' L' + (b.x + W / 2) + ',' + b.y, class: 'rt-edge' + (onPath.has(c.id) ? ' on' : '') }));
      }
      // pointer arguments are the same in every call (the array, the root): leave them out of the label
      const short = (c) => Object.values(c.args || {}).filter((v) => !/^(0x[0-9a-f]+|NULL)( |$)/.test(String(v)) || /NULL/.test(String(v))).map((v) => String(v).replace(/ .*/, '')).join(', ');
      for (const c of seen) {
        const p = pos.get(c.id);
        const done = c.to !== null && c.to < i;
        const g = el('g', { class: 'rt-node' + (onPath.has(c.id) ? (fr.calls[fr.calls.length - 1].id === c.id ? ' top' : ' on') : done ? ' done' : '') });
        g.appendChild(el('rect', { x: p.x, y: p.y, width: W, height: H, rx: 7 }));
        let label = c.fn + '(' + short(c) + ')';
        if (label.length > 19) label = label.slice(0, 18) + '…';
        g.appendChild(el('text', { x: p.x + W / 2, y: p.y + (done && c.ret !== undefined ? 13 : 19), 'text-anchor': 'middle' }, label));
        if (done && c.ret !== undefined) g.appendChild(el('text', { x: p.x + W / 2, y: p.y + 25, 'text-anchor': 'middle', class: 'rt-ret' }, 'returned ' + c.ret));
        const tt = el('title', {}, c.fn + '(' + Object.entries(c.args || {}).map(([k, v]) => k + '=' + v).join(', ') + ')' + (done && c.ret !== undefined ? ' returned ' + c.ret : ''));
        g.appendChild(tt);
        svgEl.appendChild(g);
      }
      const wrap = h('div.rtree-wrap', svgEl);
      // keep the newest call in view
      const top = fr.calls && fr.calls.length ? pos.get(fr.calls[fr.calls.length - 1].id) : null;
      if (top) requestAnimationFrame(() => { wrap.scrollLeft = Math.max(0, top.x - wrap.clientWidth / 2); });
      return wrap;
    }
    /** Memory as See draws it: the stack frames and the heap blocks, with what changed in this step lit */
    memoryView() {
      const box = h('div.memv', { id: 'memoryView' });
      const fr = this.frames[this.i];
      const mem = fr && fr.mem;
      if (!mem) { box.appendChild(h('div.muted', 'Memory shows here while the program runs.')); return box; }
      const prev = this.i > 0 && this.frames[this.i - 1].mem;
      const before = new Map();
      if (prev) { for (const f of prev.frames) for (const v of f.vars) before.set(f.fp + ':' + v.name, v.text); for (const b of prev.heap) before.set('#' + b.id, (b.free ? 'free' : '') + b.text); }
      const stack = h('div.mem-col', h('div.sec-t', 'Stack'));
      mem.frames.forEach((f, k) => {
        const card = h('div.mem-frame' + (k === 0 ? '.mem-top' : ''), h('div.mem-fn', f.fn + '()'));
        for (const v of f.vars) {
          const changed = prev && before.has(f.fp + ':' + v.name) && before.get(f.fp + ':' + v.name) !== v.text;
          const val = h('span.mem-val', v.text.replace(/ \(not set\)$/, ''));
          if (/\(not set\)$/.test(v.text)) val.classList.add('unset'), val.textContent = '?';
          if (v.block) { val.textContent = v.text.replace(/ -> heap #\d+.*/, ''); val.appendChild(h('span.mem-ptr', { dataset: { block: String(v.block) } }, '→ #' + v.block)); }
          card.appendChild(h('div.mem-row' + (changed ? '.chg' : ''), h('span.mem-name', v.name), h('span.mem-type', v.type), val));
        }
        stack.appendChild(card);
      });
      const heap = h('div.mem-col', h('div.sec-t', 'Heap'));
      if (!mem.heap.length) heap.appendChild(h('div.muted', 'Nothing has been allocated.'));
      for (const b of mem.heap) {
        const changed = prev && before.has('#' + b.id) && before.get('#' + b.id) !== (b.free ? 'free' : '') + b.text;
        const fresh = prev && !before.has('#' + b.id);
        heap.appendChild(h('div.mem-block' + (b.free ? '.freed' : '') + (changed || fresh ? '.chg' : ''), { dataset: { block: String(b.id) } },
          h('div.mem-bh', h('b', '#' + b.id), h('span.mem-type', b.free ? 'freed' : b.type || b.size + ' bytes'), h('span.mem-addr', X.hex(b.addr))),
          b.free ? null : h('div.mem-val', b.text || '')));
      }
      box.append(stack, heap);
      // hovering a pointer lights the block it points to
      box.addEventListener('mouseover', (e) => { const p = e.target.closest('.mem-ptr'); box.querySelectorAll('.mem-block.lit').forEach((x) => x.classList.remove('lit')); if (p) { const t = box.querySelector('.mem-block[data-block="' + p.dataset.block + '"]'); if (t) t.classList.add('lit'); } });
      return box;
    }
    scrollCode() {
      const fr = this.frames[this.i];
      if (!this.lineEls) return;
      for (const el of this.lineEls) el.classList.remove('cur');
      if (!fr || !fr.line) return;
      const el = this.lineEls[fr.line - 1];
      if (!el) return;
      el.classList.add('cur');
      if (this.tab === 'code') {
        const box = this.tabBody;
        const top = el.offsetTop, hgt = box.clientHeight;
        if (top < box.scrollTop + 30 || top > box.scrollTop + hgt - 50) box.scrollTop = Math.max(0, top - hgt / 3);
      }
    }

    // ---- moving through the frames -----------------------------------------------------------------------
    go(i, instant) {
      i = Math.max(0, Math.min(this.frames.length - 1, i));
      const back = i < this.i;
      this.i = i;
      const fr = this.frames[i];
      const dur = instant ? 0 : Math.min(SPEEDS[this.app.settings.speed] * 0.75, 650) * (back ? 0.7 : 1);
      this.stage.show(fr, { duration: dur });
      this.range.value = String(i);
      this.posEl.textContent = (i + 1) + ' / ' + this.frames.length;
      this.sayEl.innerHTML = '';
      this.sayEl.appendChild(h('span.step', fr.tag === 'enter' ? 'Start' : i === this.frames.length - 1 ? 'Finished' : 'Line ' + (fr.line || '')));
      this.sayEl.appendChild(document.createTextNode(fr.say || ''));
      this.scrollCode();
      this.renderCounters(fr);
      if (this.tab === 'calls' || this.tab === 'memory') this.showTab(this.tab);
      this.backBtn.disabled = i === 0;
      this.fwdBtn.disabled = i === this.frames.length - 1;
      this.clearPredict();
      if (i === this.frames.length - 1 && this.res && this.res.ok) this.app.markDone(this.t);
      if (this.app.settings.sound && !instant && X.Sound) X.Sound.play(fr.tag);
    }
    renderCounters(fr) {
      const c = fr.counters || {};
      const prev = this.i > 0 ? this.frames[this.i - 1].counters || {} : {};
      const show = this.t.counters || ['compares', 'follows', 'allocs'];
      const NAMES = { compares: 'comparisons', swaps: 'swaps', moves: 'moves', follows: 'pointer steps', allocs: 'mallocs', frees: 'frees', writes: 'writes to memory' };
      this.countersEl.innerHTML = '';
      for (const k of show) this.countersEl.appendChild(h('div.counter' + (c[k] !== prev[k] ? '.bump' : ''), h('b', String(c[k] || 0)), h('span', NAMES[k] || k)));
    }
    step(d) {
      this.pause();
      if (d > 0 && this.pendingPredict()) return;
      this.go(this.i + d);
    }
    toggle() { if (this.playing) this.pause(); else this.play(); }
    play() {
      if (this.i >= this.frames.length - 1) this.go(0, true);
      this.playing = true;
      this.playBtn.innerHTML = ''; this.playBtn.appendChild(icon('pause')); this.playBtn.setAttribute('aria-label', 'Pause');
      this.tick();
    }
    pause() {
      this.playing = false;
      clearTimeout(this.timer);
      if (this.playBtn) { this.playBtn.innerHTML = ''; this.playBtn.appendChild(icon('run')); this.playBtn.setAttribute('aria-label', 'Play'); }
    }
    tick() {
      clearTimeout(this.timer);
      if (!this.playing || this.disposed) return;
      if (this.i >= this.frames.length - 1) { this.pause(); return; }
      if (this.pendingPredict()) { this.pause(); return; }
      this.timer = setTimeout(() => { if (!this.playing) return; this.go(this.i + 1); this.tick(); }, SPEEDS[this.app.settings.speed] * (this.frames[this.i].slow ? 1.6 : 1));
    }
    redraw() { this.stage.view = null; this.go(this.i, true); }

    // ---- predictions -----------------------------------------------------------------------------------
    /** If this frame asks a question that has not been answered, show it and stop */
    pendingPredict() {
      const fr = this.frames[this.i];
      if (!fr.predict || !this.app.settings.predict || this.answered.has(this.i)) return false;
      this.showPredict(fr.predict);
      return true;
    }
    showPredict(p) {
      this.clearPredict();
      const box = h('div.predict', { id: 'predict', role: 'dialog', 'aria-label': 'Predict' });
      box.append(h('h4', 'Predict'), h('p', p.ask));
      const skip = h('button.btn.skip', { type: 'button', id: 'predictSkip' }, 'Show me');
      skip.addEventListener('click', () => this.reveal(null));
      if (p.pick === 'option' && p.options) {
        const opts = h('div.opts');
        for (const o of p.options) { const b = h('button.chip', { type: 'button' }, String(o)); b.addEventListener('click', () => this.reveal(String(o))); opts.appendChild(b); }
        opts.appendChild(skip);
        box.appendChild(opts);
      } else {
        this.stageWrap.classList.add('picking');
        box.appendChild(h('div.opts', h('span.muted', 'Click it on the picture.'), skip));
      }
      this.predictBox = box;
      this.predictQ = p;
      // under the narration, so it never covers what has to be clicked
      this.sayEl.after(box);
    }
    pick(key) {
      if (!this.predictQ || this.predictQ.pick === 'option') return;
      this.reveal(key);
    }
    reveal(given) {
      const p = this.predictQ;
      if (!p) return;
      this.answered.add(this.i);
      this.stageWrap.classList.remove('picking');
      const right = given !== null && String(given) === String(p.answer);
      const res = h('div.res' + (given === null ? '' : right ? '.good' : '.bad'), given === null ? '' : right ? 'Right.' : 'Not quite.');
      const box = this.predictBox;
      box.querySelectorAll('.opts').forEach((o) => o.remove());
      box.appendChild(res);
      if (p.explain) box.appendChild(h('p', { style: { marginTop: '4px' } }, p.explain));
      const go = h('button.btn.primary', { type: 'button', id: 'predictGo' }, 'See it happen');
      go.addEventListener('click', () => { this.clearPredict(); this.go(this.i + 1); });
      box.appendChild(go);
      this.predictQ = null;
      go.focus();
    }
    clearPredict() { if (this.predictBox) { this.predictBox.remove(); this.predictBox = null; } this.predictQ = null; if (this.stageWrap) this.stageWrap.classList.remove('picking'); }

    // ---- quiz and See --------------------------------------------------------------------------------------
    quiz() {
      const t = this.t;
      const box = h('div');
      let score = 0, answered = 0;
      const sc = h('p.muted', { id: 'quizScore' });
      for (const q of t.quiz || []) {
        const qb = h('div.quiz-q', h('h4', q.q));
        const why = h('div.quiz-why');
        q.options.forEach((o, k) => {
          const b = h('button.quiz-opt', { type: 'button' }, o);
          b.addEventListener('click', () => {
            if (qb.dataset.done) return;
            qb.dataset.done = '1';
            answered++;
            if (k === q.answer) { score++; b.classList.add('right'); } else { b.classList.add('wrong'); qb.querySelectorAll('.quiz-opt')[q.answer].classList.add('right'); }
            why.textContent = q.why || '';
            sc.textContent = score + ' of ' + answered + ' right so far';
          });
          qb.appendChild(b);
        });
        qb.appendChild(why);
        box.appendChild(qb);
      }
      box.appendChild(sc);
      SEE.UI.modal({ title: 'Quiz: ' + t.title, body: box, wide: true, buttons: [{ label: 'Close', value: true, primary: true }] });
    }
    openInSee() {
      const code = this.code || '';
      if (!SEE.Share) { SEE.UI.toast('Sharing is not available', 'err'); return; }
      SEE.Share.pack({ name: this.t.id, main: 'main.c', lang: 'c89' }, { 'main.c': SEE.utf8(code) }).then((c) => {
        window.open('https://see.jyotiprakash.org/#share=' + c, '_blank', 'noopener');
      });
    }
  }

  X.Player = Player;
})(SEE);
