// The stage: draws a frame (a list of keyed items) as SVG and animates from one frame to the next.
// Items keep their identity by key, so a node that moves slides, an arrow whose target changes swings
// over, new items fade in and removed ones leave the way their frame says.
//
// Item kinds:
//   node   {x, y, w, h, cells: [{text, w, cls, port}], cls, label}  boxes split into cells; a cell with
//          `port` is where an arrow of that name starts
//   cell   {x, y, w, h, text, sub, cls}                            an array element, index under it
//   bar    {x, y, w, h, text, cls}                                 y is the baseline; grows upwards
//   arrow  {from: {key, port} | {x, y}, to: {key, side} | {x, y}, cls, bend, label}
//   cursor {at: key, side: 'below'|'above'|'left'|'right', text, cls, slot}
//   text   {x, y, text, cls, anchor, size}
//   region {x, y, w, h, cls, text}                                 a shaded area behind things
//   token  {x, y, r, cls, text}                                    a small marker that travels
//   line   {x1, y1, x2, y2, cls}
//   ring   {x, y, r, cls}
// Common: key, opacity, enter: 'fade'|'drop'|'grow'|'fly' (with from {x,y}), exit: 'fade'|'fall'|'shrink',
//   arc (height of the hop when moving), flash (pulse once), dim.
(function (SEE) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;
  const svg = (tag, attrs) => { const e = document.createElementNS(NS, tag); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  class Stage {
    constructor(el, opts) {
      this.el = el;
      this.opts = opts || {};
      this.root = svg('svg', { class: 'stage-svg', role: 'img', 'aria-label': 'Animation' });
      const defs = svg('defs');
      for (const [id, cls] of [['ah', 'arrowhead'], ['ahHot', 'arrowhead hot'], ['ahDim', 'arrowhead dim'], ['ahBad', 'arrowhead bad'], ['ahAlt', 'arrowhead alt']]) {
        const m = svg('marker', { id: 'strux-' + id, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' });
        m.appendChild(svg('path', { d: 'M0,0 L10,5 L0,10 z', class: cls }));
        defs.appendChild(m);
      }
      this.root.appendChild(defs);
      this.layers = {};
      for (const l of ['back', 'lines', 'arrows', 'items', 'cursors', 'top']) { const g = svg('g', { class: 'layer-' + l }); this.layers[l] = g; this.root.appendChild(g); }
      el.appendChild(this.root);
      this.items = new Map();      // key -> {spec, el, cur, from, to}
      this.view = null;            // current viewBox {x, y, w, h}
      this.anim = null;
      this.onPick = null;          // click on an item (for predict questions)
      this.root.addEventListener('click', (e) => {
        if (this.justPanned) { this.justPanned = false; return; }
        const g = e.target.closest('[data-key]');
        if (g && this.onPick) this.onPick(g.dataset.key, e);
      });
    }

    /** Show a frame. opts: {duration (ms), instant} */
    show(frame, opts) {
      opts = opts || {};
      const dur = opts.instant ? 0 : (opts.duration === undefined ? 450 : opts.duration);
      if (this.anim) this.finish();
      const next = new Map();
      for (const it of frame.items || []) { if (it && it.key) next.set(it.key, it); }
      const tr = { start: performance.now(), dur, list: [] };
      // update and add
      for (const [k, spec] of next) {
        let o = this.items.get(k);
        if (!o) {
          o = { spec, el: this.make(spec), cur: this.startState(spec, next) };
          this.items.set(k, o);
          this.layers[layerOf(spec)].appendChild(o.el);
          o.from = Object.assign({}, o.cur);
          o.to = this.targetState(spec);
          o.entering = true;
        } else {
          if (o.spec.kind !== spec.kind) { o.el.remove(); o.el = this.make(spec); this.layers[layerOf(spec)].appendChild(o.el); }
          o.from = Object.assign({}, o.cur);
          o.prevSpec = o.spec;
          o.spec = spec;
          o.to = this.targetState(spec);
          o.entering = false;
          this.update(o);
        }
        o.leaving = false;
        tr.list.push(o);
      }
      // remove
      for (const [k, o] of this.items) {
        if (next.has(k)) continue;
        if (o.leaving) { tr.list.push(o); continue; }
        o.leaving = true;
        o.from = Object.assign({}, o.cur);
        o.to = this.exitState(o.spec, o.cur);
        tr.list.push(o);
      }
      // camera
      const bounds = frame.view || this.bounds(next);
      tr.viewFrom = this.view || bounds;
      tr.viewTo = bounds;
      this.anim = tr;
      if (!dur) { this.finish(); return; }
      const step = (now) => {
        if (this.anim !== tr) return;
        const t = Math.min(1, (now - tr.start) / tr.dur);
        this.paint(tr, ease(t), t);
        if (t < 1) requestAnimationFrame(step); else this.finish();
      };
      requestAnimationFrame(step);
    }
    finish() {
      const tr = this.anim;
      if (!tr) return;
      this.anim = null;
      this.paint(tr, 1, 1);
      for (const o of tr.list) {
        if (o.leaving) { o.el.remove(); for (const [k, v] of this.items) if (v === o) this.items.delete(k); }
        o.entering = false;
        if (o.el.classList.contains('flash')) setTimeout(() => o.el.classList.remove('flash'), 600);
      }
    }

    // ---- states: the numbers that tween --------------------------------------------------------------
    targetState(s) {
      const st = { opacity: s.opacity === undefined ? 1 : s.opacity };
      for (const k of ['x', 'y', 'w', 'h', 'r', 'x1', 'y1', 'x2', 'y2']) if (s[k] !== undefined) st[k] = s[k];
      if (s.kind === 'bar') { st.h = s.h; }
      return st;
    }
    startState(s, all) {
      const t = this.targetState(s);
      const st = Object.assign({}, t);
      switch (s.enter) {
        case 'drop': st.y = (t.y || 0) - 60; st.opacity = 0; break;
        case 'grow': if (st.w !== undefined) { st.x += st.w / 2; st.w = 0; } if (st.h !== undefined && s.kind !== 'bar') { st.y += st.h / 2; st.h = 0; } if (st.r !== undefined) st.r = 0; if (s.kind === 'bar') st.h = 0; break;
        case 'fly': if (s.from) { st.x = s.from.x; st.y = s.from.y; } break;
        case 'none': break;
        default: st.opacity = 0;
      }
      void all;
      return st;
    }
    exitState(s, cur) {
      const st = Object.assign({}, cur);
      switch (s.exit) {
        case 'fall': st.y = (cur.y || 0) + 90; st.opacity = 0; break;
        case 'shrink': if (st.w !== undefined) { st.x += st.w / 2; st.w = 0; } if (st.r !== undefined) st.r = 0; st.opacity = 0; break;
        case 'fly': if (s.toward) { st.x = s.toward.x; st.y = s.toward.y; } st.opacity = 0; break;
        default: st.opacity = 0;
      }
      return st;
    }

    // ---- painting one moment of a transition ------------------------------------------------------------
    paint(tr, e, raw) {
      // positions first, so arrows and cursors can follow the boxes they belong to
      for (const o of tr.list) {
        const c = {};
        for (const k in o.to) c[k] = lerp(o.from[k] === undefined ? o.to[k] : o.from[k], o.to[k], e);
        // a hop: items marked arc rise and fall on the way (a swap looks like two hands crossing)
        if (o.spec.arc && !o.entering && o.from.x !== undefined && Math.abs((o.from.x || 0) - (o.to.x || 0)) > 0.5) c.y -= Math.sin(Math.PI * raw) * o.spec.arc;
        o.cur = c;
        this.place(o);
      }
      // the camera
      const v = { x: lerp(tr.viewFrom.x, tr.viewTo.x, e), y: lerp(tr.viewFrom.y, tr.viewTo.y, e), w: lerp(tr.viewFrom.w, tr.viewTo.w, e), h: lerp(tr.viewFrom.h, tr.viewTo.h, e) };
      this.view = v;
      this.applyView();
      for (const o of tr.list) if (o.spec.kind === 'arrow') this.drawArrow(o, e);
      for (const o of tr.list) if (o.spec.kind === 'cursor') this.drawCursor(o, e);
    }

    /** The camera's view, with the reader's own zoom and pan on top */
    applyView() {
      const v = this.view;
      if (!v) return;
      const z = this.zoom || 1, px = this.panX || 0, py = this.panY || 0;
      const w = v.w / z, hh = v.h / z;
      this.root.setAttribute('viewBox', (v.x + (v.w - w) / 2 + px) + ' ' + (v.y + (v.h - hh) / 2 + py) + ' ' + w + ' ' + hh);
    }
    setZoom(z, keepPan) {
      this.zoom = Math.max(1, Math.min(4, z));
      if (this.zoom === 1 || !keepPan) { this.panX = 0; this.panY = 0; }
      this.applyView();
      if (this.onZoom) this.onZoom(this.zoom);
    }
    /** Drag to pan and pinch or ctrl+wheel to zoom, once zoomed in */
    enableZoom() {
      const el = this.root;
      let drag = null;
      const pts = new Map();
      const unit = () => { const r = el.getBoundingClientRect(); const v = this.view || { w: r.width }; return v.w / (this.zoom || 1) / Math.max(1, r.width); };
      el.addEventListener('wheel', (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        this.setZoom((this.zoom || 1) * (e.deltaY < 0 ? 1.15 : 1 / 1.15), true);
      }, { passive: false });
      el.addEventListener('pointerdown', (e) => {
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2) { const [a, b] = [...pts.values()]; drag = { pinch: Math.hypot(a.x - b.x, a.y - b.y), z: this.zoom || 1 }; return; }
        if ((this.zoom || 1) > 1) drag = { x: e.clientX, y: e.clientY, px: this.panX || 0, py: this.panY || 0, moved: false };
      });
      el.addEventListener('pointermove', (e) => {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (!drag) return;
        if (drag.pinch && pts.size === 2) { const [a, b] = [...pts.values()]; this.setZoom(drag.z * Math.hypot(a.x - b.x, a.y - b.y) / drag.pinch, true); return; }
        if (drag.pinch) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 5) return;
        drag.moved = true;
        el.setPointerCapture(e.pointerId);
        const u = unit();
        this.panX = drag.px - dx * u; this.panY = drag.py - dy * u;
        this.applyView();
      });
      const end = (e) => { pts.delete(e.pointerId); if (pts.size < 2 && drag && drag.pinch) drag = null; if (!pts.size) { if (drag && drag.moved) this.justPanned = true; drag = null; } };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    }

    // ---- making and placing elements -------------------------------------------------------------------
    make(s) {
      const g = svg('g', { 'data-key': s.key });
      switch (s.kind) {
        case 'node': {
          g.appendChild(svg('rect', { class: 'node-box', rx: '7' }));
          g.appendChild(svg('g', { class: 'node-cells' }));
          g.appendChild(svg('text', { class: 'node-label', 'text-anchor': 'middle' }));
          break;
        }
        case 'cell': g.appendChild(svg('rect', { class: 'cell-box', rx: '4' })); g.appendChild(svg('text', { class: 'cell-text', 'text-anchor': 'middle' })); g.appendChild(svg('text', { class: 'cell-sub', 'text-anchor': 'middle' })); break;
        case 'bar': g.appendChild(svg('rect', { class: 'bar-box', rx: '3' })); g.appendChild(svg('text', { class: 'bar-text', 'text-anchor': 'middle' })); break;
        case 'arrow': g.appendChild(svg('path', { class: 'arrow-path' })); g.appendChild(svg('text', { class: 'arrow-label', 'text-anchor': 'middle' })); break;
        case 'cursor': g.appendChild(svg('path', { class: 'cursor-stem' })); g.appendChild(svg('rect', { class: 'cursor-tag', rx: '5' })); g.appendChild(svg('text', { class: 'cursor-text', 'text-anchor': 'middle' })); break;
        case 'text': g.appendChild(svg('text', { class: 'free-text' })); break;
        case 'region': g.appendChild(svg('rect', { class: 'region-box', rx: '10' })); g.appendChild(svg('text', { class: 'region-text' })); break;
        case 'token': g.appendChild(svg('circle', { class: 'token-dot' })); g.appendChild(svg('text', { class: 'token-text', 'text-anchor': 'middle' })); break;
        case 'line': g.appendChild(svg('line', { class: 'plain-line' })); break;
        case 'ring': g.appendChild(svg('circle', { class: 'ring-circle' })); break;
        case 'vertex': g.appendChild(svg('circle', { class: 'vertex-circle' })); g.appendChild(svg('text', { class: 'vertex-text', 'text-anchor': 'middle' })); g.appendChild(svg('text', { class: 'vertex-sub', 'text-anchor': 'middle' })); break;
      }
      const o = { spec: s, el: g };
      this.update(o);
      return g;
    }
    /** Things that change without tweening: text, classes */
    update(o) {
      const s = o.spec, g = o.el;
      g.setAttribute('class', 'it it-' + s.kind + (s.cls ? ' ' + s.cls : '') + (s.dim ? ' dim' : '') + (s.pick ? ' pickable' : ''));
      if (s.flash) { g.classList.remove('flash'); void g.getBBox; g.classList.add('flash'); }
      if (s.title) { let t = g.querySelector('title'); if (!t) { t = svg('title'); g.appendChild(t); } t.textContent = s.title; }
      switch (s.kind) {
        case 'node': {
          const cg = g.querySelector('.node-cells');
          cg.innerHTML = '';
          for (const c of s.cells || []) {
            const cr = svg('rect', { class: 'node-cell' + (c.cls ? ' ' + c.cls : '') });
            const ct = svg('text', { class: 'node-text' + (c.cls ? ' ' + c.cls : ''), 'text-anchor': 'middle' });
            ct.textContent = c.text === undefined ? '' : String(c.text);
            cg.appendChild(cr); cg.appendChild(ct);
          }
          g.querySelector('.node-label').textContent = s.label || '';
          break;
        }
        case 'cell': g.querySelector('.cell-text').textContent = s.text === undefined || s.text === null ? '' : String(s.text); g.querySelector('.cell-sub').textContent = s.sub === undefined ? '' : String(s.sub); break;
        case 'bar': g.querySelector('.bar-text').textContent = s.text === undefined ? '' : String(s.text); break;
        case 'arrow': g.querySelector('.arrow-label').textContent = s.label || ''; break;
        case 'cursor': g.querySelector('.cursor-text').textContent = s.text || ''; break;
        case 'text': { const t = g.querySelector('text'); t.textContent = s.text || ''; t.setAttribute('text-anchor', s.anchor || 'start'); if (s.size) t.style.fontSize = s.size + 'px'; break; }
        case 'region': g.querySelector('.region-text').textContent = s.text || ''; break;
        case 'token': g.querySelector('.token-text').textContent = s.text || ''; break;
        case 'vertex': g.querySelector('.vertex-text').textContent = s.text === undefined ? '' : String(s.text); g.querySelector('.vertex-sub').textContent = s.sub === undefined ? '' : String(s.sub); break;
      }
    }
    place(o) {
      const s = o.spec, c = o.cur, g = o.el;
      g.style.opacity = c.opacity === undefined ? 1 : c.opacity;
      switch (s.kind) {
        case 'node': {
          const r = g.querySelector('.node-box');
          r.setAttribute('x', c.x); r.setAttribute('y', c.y); r.setAttribute('width', Math.max(0, c.w)); r.setAttribute('height', Math.max(0, c.h));
          const cells = s.cells || [];
          const total = cells.reduce((a, x) => a + (x.w || 1), 0) || 1;
          const rects = g.querySelectorAll('.node-cells rect'), texts = g.querySelectorAll('.node-cells text');
          let x = c.x;
          cells.forEach((cell, i) => {
            const w = c.w * (cell.w || 1) / total;
            rects[i].setAttribute('x', x); rects[i].setAttribute('y', c.y); rects[i].setAttribute('width', Math.max(0, w)); rects[i].setAttribute('height', Math.max(0, c.h));
            texts[i].setAttribute('x', x + w / 2); texts[i].setAttribute('y', c.y + c.h / 2 + 5);
            x += w;
          });
          const lb = g.querySelector('.node-label');
          lb.setAttribute('x', c.x + c.w / 2); lb.setAttribute('y', s.labelBelow ? c.y + c.h + 15 : c.y - 7);
          break;
        }
        case 'cell': {
          const r = g.querySelector('rect');
          r.setAttribute('x', c.x); r.setAttribute('y', c.y); r.setAttribute('width', Math.max(0, c.w)); r.setAttribute('height', Math.max(0, c.h));
          const t = g.querySelector('.cell-text'); t.setAttribute('x', c.x + c.w / 2); t.setAttribute('y', c.y + c.h / 2 + 6);
          const sb = g.querySelector('.cell-sub'); sb.setAttribute('x', c.x + c.w / 2); sb.setAttribute('y', c.y + c.h + 15);
          break;
        }
        case 'bar': {
          const r = g.querySelector('rect');
          r.setAttribute('x', c.x); r.setAttribute('y', c.y - Math.max(0, c.h)); r.setAttribute('width', Math.max(0, c.w)); r.setAttribute('height', Math.max(0, c.h));
          const t = g.querySelector('text'); t.setAttribute('x', c.x + c.w / 2); t.setAttribute('y', c.y + 16);
          break;
        }
        case 'text': { const t = g.querySelector('text'); t.setAttribute('x', c.x); t.setAttribute('y', c.y); break; }
        case 'region': {
          const r = g.querySelector('rect'); r.setAttribute('x', c.x); r.setAttribute('y', c.y); r.setAttribute('width', Math.max(0, c.w)); r.setAttribute('height', Math.max(0, c.h));
          const t = g.querySelector('text'); t.setAttribute('x', c.x + 8); t.setAttribute('y', c.y + 15);
          break;
        }
        case 'token': {
          const ci = g.querySelector('circle'); ci.setAttribute('cx', c.x); ci.setAttribute('cy', c.y); ci.setAttribute('r', Math.max(0, c.r === undefined ? 9 : c.r));
          const t = g.querySelector('text'); t.setAttribute('x', c.x); t.setAttribute('y', c.y + 4);
          break;
        }
        case 'line': { const l = g.querySelector('line'); l.setAttribute('x1', c.x1); l.setAttribute('y1', c.y1); l.setAttribute('x2', c.x2); l.setAttribute('y2', c.y2); break; }
        case 'ring': { const ci = g.querySelector('circle'); ci.setAttribute('cx', c.x); ci.setAttribute('cy', c.y); ci.setAttribute('r', Math.max(0, c.r)); break; }
        case 'vertex': {
          const r = c.r === undefined ? 24 : c.r;
          const ci = g.querySelector('circle'); ci.setAttribute('cx', c.x); ci.setAttribute('cy', c.y); ci.setAttribute('r', Math.max(0, r));
          const t = g.querySelector('.vertex-text'); t.setAttribute('x', c.x); t.setAttribute('y', c.y + 6);
          const sb = g.querySelector('.vertex-sub'); sb.setAttribute('x', c.x); sb.setAttribute('y', c.y + (s.subAbove ? -r - 8 : r + 17));
          break;
        }
      }
    }

    /** Where an arrow end is: a node's port or side, or a fixed point */
    anchor(end, other, isFrom) {
      if (!end) return null;
      if (end.x !== undefined && end.key === undefined) return { x: end.x, y: end.y };
      const o = this.items.get(end.key);
      if (!o) return null;
      const s = o.spec, c = o.cur;
      if (s.kind === 'node' && isFrom && end.port) {
        const cells = s.cells || [];
        const total = cells.reduce((a, x) => a + (x.w || 1), 0) || 1;
        let x = c.x;
        for (const cell of cells) {
          const w = c.w * (cell.w || 1) / total;
          if (cell.port === end.port) return { x: x + w / 2, y: c.y + c.h / 2, inside: true };
          x += w;
        }
      }
      const cx = c.x + (c.w || 0) / 2, cy = c.y + (c.h || 0) / 2;
      if (s.kind === 'token' || s.kind === 'ring' || s.kind === 'vertex') return { x: c.x, y: c.y, r: c.r === undefined ? (s.kind === 'vertex' ? 24 : 9) : c.r };
      const side = end.side || (other ? (Math.abs(other.x - cx) * (c.h || 40) > Math.abs(other.y - cy) * (c.w || 40) ? (other.x > cx ? 'right' : 'left') : (other.y > cy ? 'bottom' : 'top')) : 'left');
      switch (side) {
        case 'left': return { x: c.x, y: cy };
        case 'right': return { x: c.x + c.w, y: cy };
        case 'top': return { x: cx, y: c.y };
        case 'bottom': return { x: cx, y: c.y + c.h };
        case 'topleft': return { x: c.x + 10, y: c.y };
        case 'bottomleft': return { x: c.x + 10, y: c.y + c.h };
        case 'center': return { x: cx, y: cy };
      }
      return { x: cx, y: cy };
    }
    drawArrow(o, e) {
      const s = o.spec;
      const prev = o.prevSpec && o.prevSpec.kind === 'arrow' ? o.prevSpec : null;
      // the far end: when the target changed, it swings from the old target to the new one
      let a = this.anchor(s.from, null, true);
      const toNew = () => this.anchor(s.to, a, false);
      let b = toNew();
      if (prev && prev.to && s.to && (prev.to.key !== s.to.key || prev.to.side !== s.to.side) && e < 1 && !o.entering) {
        const old = this.anchor(prev.to, a, false);
        if (old && b) b = { x: lerp(old.x, b.x, e), y: lerp(old.y, b.y, e) };
      }
      if (!a || !b) { o.el.style.opacity = 0; return; }
      // circles: start and stop at the edge, not the centre
      if (a.r || b.r) {
        const ddx = b.x - a.x, ddy = b.y - a.y, dl = Math.hypot(ddx, ddy) || 1;
        if (a.r) a = { x: a.x + ddx / dl * a.r, y: a.y + ddy / dl * a.r };
        if (b.r) b = { x: b.x - ddx / dl * (b.r + 2), y: b.y - ddy / dl * (b.r + 2) };
      }
      // a circle end stops at its edge
      const p = o.el.querySelector('path');
      const bend = s.bend || 0;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      let d;
      if (s.loop) {
        // to a node on the left on the same row: go below and come back
        const down = s.loop;
        d = `M${a.x},${a.y} C${a.x + 30},${a.y + down} ${b.x - 30},${b.y + down} ${b.x},${b.y}`;
      } else if (bend) {
        const mx = (a.x + b.x) / 2 - dy / len * bend, my = (a.y + b.y) / 2 + dx / len * bend;
        d = `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`;
      } else d = `M${a.x},${a.y} L${b.x},${b.y}`;
      p.setAttribute('d', d);
      const head = /bad/.test(s.cls || '') ? 'ahBad' : /hot/.test(s.cls || '') ? 'ahHot' : /dim/.test(s.cls || '') ? 'ahDim' : /alt/.test(s.cls || '') ? 'ahAlt' : 'ah';
      if (s.noHead) p.removeAttribute('marker-end'); else p.setAttribute('marker-end', 'url(#strux-' + head + ')');
      const t = o.el.querySelector('text');
      t.setAttribute('x', (a.x + b.x) / 2 - dy / len * (bend + 10)); t.setAttribute('y', (a.y + b.y) / 2 + dx / len * (bend + 10) - 3);
    }
    drawCursor(o) {
      const s = o.spec;
      const tgt = s.at ? this.items.get(s.at) : null;
      const g = o.el;
      let x, y, tx, ty;
      const slot = s.slot || 0;
      // tags beside an item sit clear of it by their own width and stack downwards
      const half = Math.max(28, (s.text || '').length * 8 + 12) / 2;
      if (tgt && (tgt.spec.kind === 'vertex' || tgt.spec.kind === 'token')) {
        const c = tgt.cur, r = c.r === undefined ? 24 : c.r;
        const side = s.side || 'below';
        if (side === 'above') { x = c.x; y = c.y - r - 2; tx = x; ty = y - 22 - slot * 22; }
        else if (side === 'left') { x = c.x - r - 2; y = c.y; tx = x - half - 12; ty = y + slot * 24; }
        else if (side === 'right') { x = c.x + r + 2; y = c.y; tx = x + half + 12; ty = y + slot * 24; }
        else { x = c.x; y = c.y + r + 2; tx = x; ty = y + 22 + slot * 22; }
      } else if (tgt) {
        const c = tgt.cur;
        const cx = c.x + (c.w || 0) / 2, w = c.w || 0, h = c.h || 0;
        const side = s.side || 'below';
        if (side === 'below' && tgt.spec.kind === 'bar') { x = cx; y = c.y + 40; tx = x; ty = y + 20 + slot * 22; }
        else if (side === 'below') { x = cx; y = c.y + h + (tgt.spec.kind === 'cell' ? 18 : 2); tx = x; ty = y + 26 + slot * 22; }
        else if (side === 'above') { x = cx; y = (tgt.spec.kind === 'bar' ? c.y - h : c.y) - 2; tx = x; ty = y - 26 - slot * 22; }
        else if (side === 'left') { x = c.x - 2; y = c.y + h / 2; tx = x - half - 12; ty = y + slot * 24; }
        else { x = c.x + w + 2; y = c.y + h / 2; tx = x + half + 12; ty = y + slot * 24; }
      } else if (s.x !== undefined) { x = s.x; y = s.y; tx = s.tx !== undefined ? s.tx : s.x; ty = s.ty !== undefined ? s.ty : s.y + 26; }
      else { g.style.opacity = 0; return; }
      const textW = Math.max(28, (s.text || '').length * 8 + 12);
      g.querySelector('.cursor-stem').setAttribute('d', `M${tx},${ty} L${x},${y}`);
      const r = g.querySelector('.cursor-tag');
      r.setAttribute('x', tx - textW / 2); r.setAttribute('y', ty - 10); r.setAttribute('width', textW); r.setAttribute('height', 20);
      const t = g.querySelector('.cursor-text'); t.setAttribute('x', tx); t.setAttribute('y', ty + 5);
    }

    /** The box around everything in the frame, with a margin */
    bounds(items) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const add = (x, y) => { if (!isFinite(x) || !isFinite(y)) return; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
      for (const s of items.values()) {
        if (s.kind === 'arrow' || s.kind === 'cursor') continue;
        if (s.kind === 'bar') { add(s.x, s.y - s.h - 30); add(s.x + s.w, s.y + 100); continue; }
        if (s.kind === 'cell') { add(s.x, s.y - 20); add(s.x + s.w, s.y + s.h + 70); continue; }
        if (s.kind === 'line') { add(s.x1, s.y1); add(s.x2, s.y2); continue; }
        if (s.kind === 'token' || s.kind === 'ring' || s.kind === 'vertex') { const r = s.r || (s.kind === 'vertex' ? 24 : 9); add(s.x - r, s.y - r - 10); add(s.x + r, s.y + r + 20); continue; }
        if (s.kind === 'text') { const tw = String(s.text === undefined ? '' : s.text).length * 7; add(s.x, s.y - 14); add(s.x, s.y + 4); if (s.anchor === 'end') add(s.x - tw, s.y); else if (s.anchor === 'middle') { add(s.x - tw / 2, s.y); add(s.x + tw / 2, s.y); } else add(s.x + tw, s.y); continue; }
        add(s.x, s.y); add(s.x + (s.w || 0), s.y + (s.h || 0));
      }
      if (x0 === Infinity) return { x: 0, y: 0, w: 800, h: 400 };
      const m = 34;
      let w = x1 - x0 + 2 * m, h = y1 - y0 + 2 * m + 40;
      // keep a sensible minimum so a single node does not fill the screen
      const minW = 520, minH = 260;
      let x = x0 - m, y = y0 - m - 10;
      if (w < minW) { x -= (minW - w) / 2; w = minW; }
      if (h < minH) { y -= (minH - h) / 2; h = minH; }
      return { x, y, w, h };
    }
    clear() { for (const o of this.items.values()) o.el.remove(); this.items.clear(); this.view = null; }
  }
  function layerOf(s) {
    switch (s.kind) {
      case 'region': return 'back';
      case 'line': case 'ring': return 'lines';
      case 'arrow': return 'arrows';
      case 'cursor': return 'cursors';
      case 'token': return 'top';
      case 'text': return s.layer || 'items';
    }
    return 'items';
  }

  SEE.Strux = SEE.Strux || {};
  SEE.Strux.Stage = Stage;
})(SEE);
