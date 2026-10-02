// Draw your own graph for the graph topics: click empty space to add a vertex, drag a vertex to move it,
// click one vertex and then another to add or remove the edge between them.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, G = X.GraphKit;
  const { h } = SEE.UI;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (n, a, txt) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (txt !== undefined) e.textContent = txt; return e; };

  /**
   * Open the editor. input: the topic's input {n, graph, pos}; gin: the graph input (its check, weighted,
   * negative flags); nIn: the vertex-count input (lo/hi). Resolves with {n, graph, pos} or null.
   */
  X.editGraph = function (input, gin, nIn) {
    const maxN = (nIn && nIn.hi) || 10;
    let n = input.n;
    let edges;
    try { edges = G.parse(input.graph); } catch (e) { edges = []; }
    const pos = G.positions(n, input.pos).map((p) => ({ x: p.x, y: p.y }));
    const directedDefault = edges.some((e) => e[3]) || /[>]/.test(String(gin.def || ''));
    const weighted = !!gin.weighted || edges.some((e) => e[2] !== 1) || /:/.test(String(gin.def || ''));
    let directed = directedDefault;
    let sel = null;
    const W = 640, H = 440;
    const svg = el('svg', { viewBox: (-W / 2) + ' ' + (-H / 2) + ' ' + W + ' ' + H, class: 'gedit-svg', id: 'graphEditor' });
    const help = h('p.muted', { style: { margin: '0 0 8px' } }, 'Click empty space to add a vertex. Drag a vertex to move it. Click a vertex, then another, to add or remove an edge.' + (weighted ? ' You will be asked for its weight.' : ''));
    const msg = h('div.err', { id: 'geditMsg' });
    const dirBox = h('input', { type: 'checkbox', checked: directed, id: 'geditDirected' });
    dirBox.addEventListener('change', () => { directed = dirBox.checked; });
    const delLast = h('button.btn', { type: 'button', id: 'geditDropLast' }, 'Remove the last vertex');
    delLast.addEventListener('click', () => { if (n <= 1) return; n--; pos.pop(); edges = edges.filter(([u, v]) => u < n && v < n); sel = null; draw(); });
    const clear = h('button.btn', { type: 'button', id: 'geditClear' }, 'No edges');
    clear.addEventListener('click', () => { edges = []; sel = null; draw(); });
    const tools = h('div.gedit-tools', h('label', dirBox, ' New edges are directed (one-way)'), delLast, clear);
    // fit what exists into the box: positions are kept in the topic's own units
    const toSvg = (e) => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const m = svg.getScreenCTM(); const p = pt.matrixTransform(m.inverse()); return { x: p.x / scale, y: p.y / scale }; };
    let scale = 1;
    const draw = () => {
      let ext = 1;
      for (const p of pos) ext = Math.max(ext, Math.abs(p.x) / (W / 2 - 40), Math.abs(p.y) / (H / 2 - 40));
      scale = 1 / Math.max(1, ext);
      svg.innerHTML = '';
      svg.appendChild(el('defs', {})).appendChild(el('marker', { id: 'gedit-head', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' })).appendChild(el('path', { d: 'M0,0 L10,5 L0,10 z', class: 'gedit-head' }));
      for (const [u, v, w, d] of edges) {
        const a = pos[u], b = pos[v];
        const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
        const r = 22 / scale;
        const x1 = (a.x + dx / L * r) * scale, y1 = (a.y + dy / L * r) * scale, x2 = (b.x - dx / L * r) * scale, y2 = (b.y - dy / L * r) * scale;
        const line = el('line', { x1, y1, x2, y2, class: 'gedit-edge' });
        if (d) line.setAttribute('marker-end', 'url(#gedit-head)');
        svg.appendChild(line);
        if (weighted) svg.appendChild(el('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 6, class: 'gedit-w', 'text-anchor': 'middle' }, String(w)));
      }
      pos.forEach((p, i) => {
        const g = el('g', { class: 'gedit-v' + (sel === i ? ' sel' : ''), 'data-v': String(i) });
        g.appendChild(el('circle', { cx: p.x * scale, cy: p.y * scale, r: 20 }));
        g.appendChild(el('text', { x: p.x * scale, y: p.y * scale + 5, 'text-anchor': 'middle' }, String(i)));
        svg.appendChild(g);
      });
      delLast.disabled = n <= 1;
    };
    let drag = null;
    svg.addEventListener('pointerdown', (e) => {
      const g = e.target.closest('.gedit-v');
      msg.textContent = '';
      if (g) { const v = +g.dataset.v; drag = { v, moved: false, start: toSvg(e) }; svg.setPointerCapture(e.pointerId); return; }
      if (n >= maxN) { msg.textContent = 'At most ' + maxN + ' vertices.'; return; }
      const p = toSvg(e);
      pos.push({ x: Math.round(p.x), y: Math.round(p.y) });
      n++;
      sel = null;
      draw();
    });
    svg.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = toSvg(e);
      if (!drag.moved && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < 6) return;
      drag.moved = true;
      pos[drag.v] = { x: Math.round(p.x), y: Math.round(p.y) };
      draw();
    });
    svg.addEventListener('pointerup', () => {
      if (!drag) return;
      const v = drag.v, moved = drag.moved;
      drag = null;
      if (moved) return;
      if (sel === null) { sel = v; draw(); return; }
      if (sel === v) { sel = null; draw(); return; }
      const a = sel, b = v;
      sel = null;
      const same = (e) => (e[0] === a && e[1] === b) || (!e[3] && !directed && e[0] === b && e[1] === a) || (!e[3] && e[0] === b && e[1] === a);
      const had = edges.findIndex(same);
      if (had >= 0) { edges.splice(had, 1); draw(); return; }
      let w = 1;
      if (weighted) {
        const t = window.prompt('Weight of the edge ' + a + (directed ? ' → ' : ' – ') + b, '1');
        if (t === null) { draw(); return; }
        w = parseInt(t, 10);
        if (!Number.isInteger(w) || w === 0 || Math.abs(w) > 999) { msg.textContent = 'A weight is a whole number from -999 to 999, not 0.'; draw(); return; }
      }
      edges.push([a, b, w, directed]);
      draw();
    });
    draw();
    const body = h('div', help, svg, tools, msg);
    return SEE.UI.modal({
      title: 'Edit the graph', body, wide: true,
      buttons: [{ label: 'Cancel', value: null }, { label: 'Use this graph', primary: true, keepOpen: true, value: () => {
        const out = { n, graph: G.format(edges), pos: pos.map((p) => [Math.round(p.x), Math.round(p.y)]) };
        const e = gin.check ? gin.check(out.graph, Object.assign({}, input, out)) : null;
        if (e) { msg.textContent = e; return undefined; }
        return out;
      } }],
    });
  };
})(SEE);
